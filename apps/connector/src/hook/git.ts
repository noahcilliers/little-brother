import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

/** `gitDir` holds HEAD; `commonDir` holds refs shared by linked worktrees. Absent outside a repo. */
export type RepoInfo = { root: string; repo: string; branch: string; gitDir?: string; commonDir?: string };

function read(p: string): string | null {
  try {
    return readFileSync(p, "utf8").trim();
  } catch {
    return null;
  }
}

/** Resolves the git dir for a `.git` entry, following the `gitdir:` file that worktrees use. */
function gitDirOf(dotGit: string): string | null {
  if (statSync(dotGit).isDirectory()) return dotGit;
  const m = /^gitdir:\s*(.+)$/m.exec(read(dotGit) ?? "");
  if (!m?.[1]) return null;
  return isAbsolute(m[1]) ? m[1] : resolve(dirname(dotGit), m[1]);
}

/**
 * Reads .git directly instead of spawning git: hooks run on every tool call and a spawn costs
 * ~10-30 ms. Linked worktrees report the main checkout's name so all agents share one repo key.
 */
export function repoInfo(cwd: string): RepoInfo {
  try {
    let dir = resolve(cwd);
    for (;;) {
      const dotGit = join(dir, ".git");
      if (existsSync(dotGit)) {
        const gitDir = gitDirOf(dotGit);
        if (!gitDir) break;
        const common = read(join(gitDir, "commondir"));
        const commonDir = common ? resolve(gitDir, common) : gitDir;
        const repoDir = common ? dirname(commonDir) : dir;
        const head = read(join(gitDir, "HEAD")) ?? "";
        const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
        return {
          root: dir,
          repo: basename(repoDir),
          branch: ref?.[1] ?? head.slice(0, 12),
          gitDir,
          commonDir,
        };
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // fall through to the cwd-based guess
  }
  return { root: cwd, repo: basename(cwd), branch: "" };
}
