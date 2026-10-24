import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { claimBackgroundSlot, hasOrigin } from "../src/hook/background";
import { repoInfo } from "../src/hook/git";
import { baseRev, gitOpFor, headSha } from "../src/hook/git-state";
import { backgroundMergeCheck } from "../src/verify/background";
import { git } from "../src/verify/git";
import { tempHome } from "./helpers";

function repo(): { dir: string; g: (...args: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "lb-git-state-"));
  const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" }).toString().trim();
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  writeFileSync(join(dir, "a.txt"), "base\n");
  g("add", ".");
  g("commit", "-qm", "base");
  return { dir, g };
}

beforeEach(() => {
  process.env.LB_HOME = tempHome();
});

describe("baseRev", () => {
  it("is the merge-base with main and is cached per HEAD", () => {
    const { dir, g } = repo();
    const base = g("rev-parse", "HEAD");
    g("checkout", "-qb", "noah/auth");
    writeFileSync(join(dir, "b.txt"), "b\n");
    g("add", ".");
    g("commit", "-qm", "b");
    const info = repoInfo(dir);
    expect(headSha(info)).toBe(g("rev-parse", "HEAD"));
    expect(baseRev(info)).toBe(base);
    const cache = join(process.env.LB_HOME ?? "", "cache", "base-rev.json");
    expect(JSON.parse(readFileSync(cache, "utf8"))).toEqual({ [`${dir}|${g("rev-parse", "HEAD")}`]: base });
    // A poisoned cache entry proves the second call never spawned git.
    writeFileSync(cache, JSON.stringify({ [`${dir}|${g("rev-parse", "HEAD")}`]: "cached" }));
    expect(baseRev(info)).toBe("cached");
  });

  it("resolves packed refs and omits the base outside a repo", () => {
    const { dir, g } = repo();
    g("pack-refs", "--all");
    expect(headSha(repoInfo(dir))).toBe(g("rev-parse", "HEAD"));
    expect(baseRev(repoInfo(mkdtempSync(join(tmpdir(), "lb-nogit-"))))).toBeUndefined();
  });
});

describe("gitOpFor", () => {
  it("reports a commit with its files, branch and sha", () => {
    const { dir, g } = repo();
    writeFileSync(join(dir, "c.txt"), "c\n");
    g("add", ".");
    g("commit", "-qm", "c");
    const op = gitOpFor("git add . && git commit -m c", dir, 0);
    expect(op).toEqual({
      op: "commit",
      ok: true,
      branch: "main",
      sha: g("rev-parse", "HEAD"),
      files: ["c.txt"],
    });
    expect(gitOpFor("git commit -m c", dir, 1)).toMatchObject({ op: "commit", ok: false, files: [] });
    expect(gitOpFor("ls", dir, 0)).toBeUndefined();
  });

  it("names the push destination", () => {
    const { dir } = repo();
    expect(gitOpFor("git push origin HEAD:main", dir, 0)).toMatchObject({
      op: "push",
      target: "origin/main",
    });
  });
});

describe("background merge check", () => {
  it("throttles to one run per repo per gap", () => {
    expect(claimBackgroundSlot("/r", 1_000_000)).toBe(true);
    expect(claimBackgroundSlot("/r", 1_000_000 + 60_000)).toBe(false);
    expect(claimBackgroundSlot("/other", 1_000_000 + 60_000)).toBe(true);
    expect(claimBackgroundSlot("/r", 1_000_000 + 121_000)).toBe(true);
  });

  it("only runs where an origin remote exists", () => {
    const { dir, g } = repo();
    expect(hasOrigin(repoInfo(dir))).toBe(false);
    g("remote", "add", "origin", "https://example.invalid/x.git");
    expect(hasOrigin(repoInfo(dir))).toBe(true);
  });

  it("posts conflicts against teammates' pushed branches, never clean results", async () => {
    const origin = repo();
    for (const [branch, content] of [
      ["joshua/auth", "joshua\n"],
      ["ash/docs", null],
    ] as const) {
      origin.g("checkout", "-qb", branch, "main");
      writeFileSync(join(origin.dir, content ? "a.txt" : "docs.md"), content ?? "docs\n");
      origin.g("add", ".");
      origin.g("commit", "-qm", branch);
    }
    origin.g("checkout", "-q", "main");
    const clone = mkdtempSync(join(tmpdir(), "lb-clone-"));
    execFileSync("git", ["clone", "-q", origin.dir, clone], { stdio: "pipe" });
    const cg = (...args: string[]) => execFileSync("git", args, { cwd: clone, stdio: "pipe" });
    cg("config", "user.email", "t@t");
    cg("config", "user.name", "t");
    cg("checkout", "-qb", "noah/auth");
    writeFileSync(join(clone, "a.txt"), "noah\n");
    cg("commit", "-qam", "noah");

    const posts: { path: string; body: unknown }[] = [];
    const branches = [
      { handle: "joshua", branch: "joshua/auth" },
      { handle: "ash", branch: "ash/docs" },
      { handle: "kim", branch: "kim/not-pushed" },
    ];
    const found = await backgroundMergeCheck(clone, "s1", {
      git,
      post: async (path, body) => {
        posts.push({ path, body });
        return path === "/mcp/branches" ? { text: JSON.stringify(branches) } : { text: "ok" };
      },
    });
    expect(found).toEqual([{ a: "noah/auth", b: "joshua/auth", files: ["a.txt"] }]);
    expect(posts.map((p) => p.path)).toEqual(["/mcp/branches", "/verify"]);
    expect(posts[1]?.body).toMatchObject({
      branches: ["noah/auth", "joshua/auth"],
      passed: true,
      background: true,
    });
  });
});
