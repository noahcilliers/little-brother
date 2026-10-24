import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyBranches } from "../src/commands/verify";

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "lb-verify-test-"));
  const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  writeFileSync(join(dir, "a.txt"), "base\n");
  writeFileSync(
    join(dir, ".littlebrother.json"),
    JSON.stringify({ verify: "test -f a.txt && echo verified" }),
  );
  g("add", ".");
  g("commit", "-qm", "base");
  for (const [branch, file, content] of [
    ["noah", "a.txt", "noah\n"],
    ["joshua", "a.txt", "joshua\n"],
    ["ash", "b.txt", "ash\n"],
  ] as const) {
    g("checkout", "-qb", branch, "main");
    writeFileSync(join(dir, file), content);
    g("add", ".");
    g("commit", "-qm", branch);
  }
  g("checkout", "-q", "main");
  return dir;
}

describe("verifyBranches", () => {
  it("runs the verify command on a clean merge", () => {
    const r = verifyBranches(repo(), ["noah", "ash"]);
    expect(r).toMatchObject({ passed: true, conflicts: [] });
    expect(r.outputTail).toContain("verified");
  });

  it("reports pairwise conflicts (R3) and fails", () => {
    const r = verifyBranches(repo(), ["noah", "joshua", "ash"]);
    expect(r.passed).toBe(false);
    expect(r.conflicts).toEqual([{ a: "noah", b: "joshua", files: ["a.txt"] }]);
  });
});
