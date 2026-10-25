import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sh } from "./exec";

/**
 * The fix-up tree's sources (no node_modules, no .git) as a tar next to the run's results, so --recheck can
 * re-grade it after the workspace is gone. The demo shop's sources are tens of kilobytes.
 */
export function archiveTree(dir: string, file: string): boolean {
  if (!existsSync(dir)) return false;
  return sh("tar", ["-cf", file, "--exclude", "node_modules", "--exclude", ".git", "-C", dir, "."], dir).ok;
}

export function restoreTree(file: string, dir: string): boolean {
  mkdirSync(dir, { recursive: true });
  return sh("tar", ["-xf", file, "-C", dir], dir).ok;
}

/**
 * A run's repo, worktrees and copied node_modules, deleted once its results are written. Django worktrees
 * are ~300 MB each and a run makes five, so keeping them filled the disk within one pilot.
 */
export function removeWorkspace(wsDir: string): void {
  rmSync(wsDir, { recursive: true, force: true });
}

/** Every file under `dir` except node_modules and .git, relative to it; for trees that aren't git repos. */
export function walkFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".git") return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkFiles(p, root) : [relative(root, p)];
  });
}
