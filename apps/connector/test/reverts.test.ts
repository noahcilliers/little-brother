import { describe, expect, it } from "vitest";
import { revertedPaths } from "../src/hook/reverts";

const ROOT = "/repo";
const FILES = new Set(["/repo/src/server.ts", "/repo/vitest.config.ts", "/repo/src", "/repo"]);
const paths = (cmd: string, cwd = ROOT) => revertedPaths(cmd, cwd, ROOT, (p) => FILES.has(p));

describe("revertedPaths", () => {
  it("reads git checkout of a file, with or without --", () => {
    expect(paths("git checkout src/server.ts && git status --short")).toEqual(["src/server.ts"]);
    expect(paths("git checkout -- vitest.config.ts")).toEqual(["vitest.config.ts"]);
    expect(paths("git checkout HEAD -- src/server.ts")).toEqual(["src/server.ts"]);
    expect(paths("git checkout .")).toEqual(["."]);
  });
  it("does not mistake a branch switch for a revert", () => {
    expect(paths("git checkout main")).toEqual([]);
    expect(paths("git checkout -b src/server.ts")).toEqual([]);
    expect(paths("git switch feat")).toEqual([]);
  });
  it("reads git restore, skipping staged-only restores", () => {
    expect(paths("git restore src/server.ts vitest.config.ts")).toEqual([
      "src/server.ts",
      "vitest.config.ts",
    ]);
    expect(paths("git restore --source HEAD~1 src/server.ts")).toEqual(["src/server.ts"]);
    expect(paths("git restore --staged src/server.ts")).toEqual([]);
    expect(paths("git restore --staged --worktree src/server.ts")).toEqual(["src/server.ts"]);
  });
  it("treats git reset --hard as the whole tree, and a soft reset as nothing", () => {
    expect(paths("git reset --hard")).toEqual(["."]);
    expect(paths("git reset HEAD~1")).toEqual([]);
  });
  it("resolves paths against cd, -C and the hook cwd", () => {
    expect(paths("cd src && git checkout server.ts")).toEqual(["src/server.ts"]);
    expect(paths("git -C src checkout -- server.ts")).toEqual(["src/server.ts"]);
    expect(paths("git checkout server.ts", "/repo/src")).toEqual(["src/server.ts"]);
  });
  it("ignores commands that are not git", () => {
    expect(paths("npm test 2>&1 | tail -30")).toEqual([]);
  });
});
