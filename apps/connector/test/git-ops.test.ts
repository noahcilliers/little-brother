import { describe, expect, it } from "vitest";
import { opTarget, parseGitOps, primaryOp, targetBranch } from "../src/hook/git-ops";

const ops = (cmd: string) => parseGitOps(cmd).map((o) => o.op);
const primary = (cmd: string) => primaryOp(parseGitOps(cmd));

describe("parseGitOps", () => {
  it("finds tracked subcommands and ignores the rest", () => {
    expect(ops("git commit -m 'fix: cors'")).toEqual(["commit"]);
    expect(ops("git status && git diff")).toEqual([]);
    expect(ops("npm test")).toEqual([]);
    expect(ops("echo 'git push'")).toEqual([]);
    expect(ops("git switch -c feat")).toEqual(["checkout"]);
  });

  it("splits chains and keeps quoted separators inside one word", () => {
    expect(ops("git add . && git commit -m 'a && b; c' && git push origin HEAD")).toEqual(["commit", "push"]);
    expect(ops("git fetch; git rebase origin/main || git rebase --abort")).toEqual(["rebase", "rebase"]);
    expect(ops("git pull --rebase\ngit merge feat")).toEqual(["pull", "merge"]);
  });

  it("tracks -C, global options, env prefixes and cd", () => {
    const [a] = parseGitOps("git -C ../shop --no-pager -c core.editor=true commit -am x");
    expect(a).toMatchObject({ op: "commit", dir: "../shop" });
    const [b] = parseGitOps("GIT_EDITOR=true git -C /abs/repo merge feat");
    expect(b).toMatchObject({ op: "merge", dir: "/abs/repo", args: ["feat"] });
    const [c] = parseGitOps("cd packages/web && git push");
    expect(c).toMatchObject({ op: "push", dir: "packages/web" });
  });

  it("reports the op that moves work furthest, so commit && push reads as a push", () => {
    expect(primary("git commit -m x && git push")?.op).toBe("push");
    expect(primary("git checkout main && git merge feat")?.op).toBe("merge");
    expect(primary("git status")).toBeUndefined();
  });
});

describe("opTarget", () => {
  const t = (cmd: string, branch = "noah/auth") => {
    const p = primary(cmd);
    return p ? opTarget(p, branch) : undefined;
  };
  it("resolves push and pull destinations", () => {
    expect(t("git push")).toBe("origin/noah/auth");
    expect(t("git push -u origin HEAD")).toBe("origin/noah/auth");
    expect(t("git push origin HEAD:main")).toBe("origin/main");
    expect(t("git push --force-with-lease upstream feat")).toBe("upstream/feat");
    expect(t("git pull origin main")).toBe("origin/main");
  });
  it("resolves merge sources and checkout targets", () => {
    expect(t("git merge --no-ff -m 'merge it' noah/auth")).toBe("noah/auth");
    expect(t("git rebase origin/main")).toBe("origin/main");
    expect(t("git checkout -b feat/x origin/main")).toBe("feat/x");
    expect(t("git switch main")).toBe("main");
    expect(t("git checkout -- src/a.ts")).toBeUndefined();
    expect(t("git commit -m x")).toBeUndefined();
  });
  it("targetBranch strips the remote", () => {
    expect(targetBranch("origin/main")).toBe("main");
    expect(targetBranch("main")).toBe("main");
    expect(targetBranch(undefined)).toBeUndefined();
  });
});
