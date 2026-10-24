import { rmSync } from "node:fs";
import { join } from "node:path";
import { sh, shOrThrow } from "../exec";
import { branchOf } from "../workspace";

const GIT_ID = ["-c", "user.name=lb-evals", "-c", "user.email=evals@little-brother.dev"];

/** A detached checkout of `ref` for grading, so the agents' worktrees stay as they left them. */
export function checkoutAt(repo: string, dir: string, ref: string): string {
  shOrThrow("git", ["worktree", "add", "-q", "--detach", dir, ref], repo);
  return dir;
}

/** Every agent branch merged onto `base`; null when any merge conflicts textually. */
export function mergedTree(repo: string, dir: string, base: string, handles: string[]) {
  shOrThrow("git", ["worktree", "add", "-q", "--detach", dir, base], repo);
  for (const h of handles) {
    const r = sh("git", [...GIT_ID, "merge", "--no-edit", "-q", branchOf(h)], dir);
    if (r.ok) continue;
    const files = sh("git", ["diff", "--name-only", "--diff-filter=U"], dir).out.trim().split("\n");
    sh("git", ["merge", "--abort"], dir);
    return { dir, conflict: files.filter(Boolean) };
  }
  return { dir, conflict: [] as string[] };
}

/**
 * Throws away what the agents did to test files, as STALE-bench's corrected harness does: an agent's own
 * test edits can make gold tests fail to apply in one condition and apply in another.
 */
export function resetPaths(dir: string, base: string, paths: string[]): void {
  if (!paths.length) return;
  const added = sh("git", ["diff", "--name-only", "--diff-filter=A", base, "--", ...paths], dir)
    .out.split("\n")
    .filter(Boolean);
  for (const f of added) rmSync(join(dir, f), { force: true });
  // One path at a time: a path missing on base (a test file the gold patch adds) would fail the whole call.
  for (const p of paths) sh("git", ["checkout", base, "--", p], dir);
}

/** Applies a gold patch, falling back to a three-way apply; false when it can't apply. */
export function applyPatch(dir: string, patch: string): boolean {
  if (sh("git", ["apply", "--whitespace=nowarn", patch], dir).ok) return true;
  return sh("git", ["apply", "--3way", "--whitespace=nowarn", patch], dir).ok;
}

/** Files a unified diff touches (its `+++ b/` lines). */
export function patchFiles(text: string): string[] {
  return [...text.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1] ?? "").filter(Boolean);
}
