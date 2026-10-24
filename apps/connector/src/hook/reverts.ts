import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { repoPath } from "../normalize/paths";
import { type GitInvocation, parseGitInvocations } from "./git-ops";

const CREATE_FLAGS = new Set(["-b", "-B", "-c", "-C", "--orphan"]);
const RESTORE_VALUE_FLAGS = new Set(["-s", "--source"]);

function afterDashes(args: string[]): string[] | null {
  const i = args.indexOf("--");
  return i >= 0 ? args.slice(i + 1) : null;
}

/**
 * `git checkout -- a b` and `git checkout HEAD -- a` name paths outright. Without `--`, git itself decides
 * between a branch and a path by what exists, so we do the same: a word that is a file or directory after
 * the command ran was a path (`git checkout src/server.ts`), anything else was a branch.
 */
function checkoutPaths(args: string[], exists: (p: string) => boolean): string[] {
  if (args.some((a) => CREATE_FLAGS.has(a))) return [];
  return afterDashes(args) ?? args.filter((a) => !a.startsWith("-") && exists(a));
}

/** `git restore --staged x` only unstages; the worktree copy (the agent's change) survives. */
function restorePaths(args: string[]): string[] {
  const staged = args.includes("--staged") || args.includes("-S");
  const worktree = args.includes("--worktree") || args.includes("-W");
  if (staged && !worktree) return [];
  const explicit = afterDashes(args);
  if (explicit) return explicit;
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (RESTORE_VALUE_FLAGS.has(a)) i++;
    else if (!a.startsWith("-")) out.push(a);
  }
  return out;
}

function pathsOf(git: GitInvocation, exists: (p: string) => boolean): string[] {
  switch (git.sub) {
    case "checkout":
      return checkoutPaths(git.args, exists);
    case "restore":
      return restorePaths(git.args);
    case "reset":
      return git.args.includes("--hard") ? ["."] : [];
    default:
      return [];
  }
}

/**
 * Repo-relative paths a shell command put back to a committed version: `git checkout <paths>`,
 * `git restore <paths>`, `git reset --hard` (the whole tree, "."). The backend uses them to turn a
 * failed attempt that the agent threw away into failure memory.
 */
export function revertedPaths(
  command: string,
  cwd: string,
  repoRoot: string,
  exists: (abs: string) => boolean = existsSync,
): string[] {
  const out = new Set<string>();
  for (const git of parseGitInvocations(command)) {
    const dir = resolve(cwd, git.dir);
    for (const p of pathsOf(git, (w) => exists(resolve(dir, w)))) out.add(repoPath(p, dir, repoRoot).rel);
  }
  return [...out];
}
