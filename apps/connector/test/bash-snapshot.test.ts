import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeTool } from "../src/normalize";

// Claude Code's auto mode edits through inline scripts; nothing in the command text names the file.
const SCRIPT = `python3 - <<'EOF'
import re
p = "src/cart/totals.py"
s = open(p).read()
s = s.replace("def compute_totals(items):", "def compute_totals(items, promo):")
open(p, "w").write(s)
EOF`;

/** A real git repo with one commit, since the snapshot reads `git status` and `HEAD`. */
function gitRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "lb-git-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"], { cwd: root });
  return root;
}

beforeEach(() => {
  process.env.LB_SESSION_DIR = mkdtempSync(join(tmpdir(), "lb-snap-"));
});

describe("Bash writes seen by diffing the working tree", () => {
  it("an inline script's signature change becomes a symbol touch", async () => {
    const root = gitRepo({ "src/cart/totals.py": "def compute_totals(items):\n    return sum(items)\n" });
    const base = { tool: "Bash", input: { command: SCRIPT }, cwd: root, repoRoot: root, snapshotKey: "tu_1" };
    const pre = await normalizeTool({ ...base, phase: "pre" });
    expect(pre.files).toEqual([]);
    execSync(SCRIPT, { cwd: root, shell: "/bin/bash" });
    const post = await normalizeTool({ ...base, phase: "post" });
    expect(post.files).toContain("src/cart/totals.py");
    expect(post.touches).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "src/cart/totals.py", op: "write" })]),
    );
    expect(
      post.touches.some((t) => t.op === "signature_change" && t.symbol?.endsWith("compute_totals")),
    ).toBe(true);
  });

  it("a command that changes nothing adds nothing", async () => {
    const root = gitRepo({ "a.ts": "export const a = 1;\n" });
    const base = { tool: "Bash", input: { command: "ls" }, cwd: root, repoRoot: root, snapshotKey: "tu_2" };
    await normalizeTool({ ...base, phase: "pre" });
    expect((await normalizeTool({ ...base, phase: "post" })).files).toEqual([]);
  });
});
