import { cpSync, existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { sh, shOrThrow } from "./exec";

const GIT_ID = ["-c", "user.name=lb-evals", "-c", "user.email=evals@little-brother.dev"];
export const REPO_NAME = "lb-demo-shop";
export const branchOf = (handle: string): string => `${handle}/work`;

/** Installs the shop's dependencies once per eval invocation; every worktree clones this tree. */
export function prepareModules(shopSrc: string, cacheDir: string): string {
  const dir = join(cacheDir, "shop");
  if (existsSync(join(dir, "node_modules"))) return join(dir, "node_modules");
  mkdirSync(dir, { recursive: true });
  for (const f of ["package.json", "package-lock.json"]) cpSync(join(shopSrc, f), join(dir, f));
  shOrThrow("npm", ["ci", "--silent", "--no-audit", "--no-fund"], dir);
  return join(dir, "node_modules");
}

/**
 * APFS clones make a full copy near-free on macOS; elsewhere fall back to a symlink. A copy matters
 * because agents may `npm install` and must not change other runs' trees.
 */
export function linkModules(modules: string, into: string): void {
  const target = join(into, "node_modules");
  if (existsSync(target)) return;
  if (process.platform === "darwin" && sh("cp", ["-cR", modules, target], into).ok) return;
  symlinkSync(modules, target, "dir");
}

export type Workspace = { repo: string; worktrees: Map<string, string> };

/** A fresh lb-demo-shop repo with one branch and worktree per agent, like demo/setup.sh --worktrees. */
export function createWorkspace(
  shopSrc: string,
  runDir: string,
  handles: string[],
  modules: string,
): Workspace {
  const repo = join(runDir, REPO_NAME);
  mkdirSync(repo, { recursive: true });
  shOrThrow(
    "rsync",
    ["-a", "--exclude", "node_modules", "--exclude", "dist", `${shopSrc}/`, `${repo}/`],
    runDir,
  );
  shOrThrow("git", ["init", "-q", "-b", "main"], repo);
  shOrThrow("git", ["add", "-A"], repo);
  shOrThrow("git", [...GIT_ID, "commit", "-q", "-m", "lb-demo-shop: API + storefront skeleton"], repo);
  const worktrees = new Map<string, string>();
  for (const h of handles) {
    const dir = join(runDir, h);
    shOrThrow("git", ["worktree", "add", "-q", "-b", branchOf(h), dir, "main"], repo);
    linkModules(modules, dir);
    worktrees.set(h, dir);
  }
  return { repo, worktrees };
}

/** Commits whatever the agent left in its worktree, so the oracle can merge branches. */
export function commitAgentWork(dir: string, handle: string): boolean {
  shOrThrow("git", ["add", "-A"], dir);
  if (sh("git", ["diff", "--cached", "--quiet"], dir).ok) return false;
  shOrThrow("git", [...GIT_ID, "commit", "-q", "--no-verify", "-m", `${handle}: eval work`], dir);
  return true;
}
