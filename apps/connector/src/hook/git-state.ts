import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { GitOp } from "@lb/core";
import { lbHome } from "../config";
import type { RepoInfo } from "./git";
import { opTarget, parseGitOps, primaryOp } from "./git-ops";

const SPAWN_TIMEOUT_MS = 400;
const CACHE_LIMIT = 200;

/** stdout of a git command, or null on any failure; hooks never throw because git did. */
export function gitOut(cwd: string, args: string[], timeout = SPAWN_TIMEOUT_MS): string | null {
  try {
    const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] });
    return r.status === 0 ? (r.stdout ?? "").trim() : null;
  } catch {
    return null;
  }
}

function readTrim(p: string): string | null {
  try {
    return readFileSync(p, "utf8").trim();
  } catch {
    return null;
  }
}

/** HEAD's commit from the files under .git, so the cache lookup needs no spawn. */
export function headSha(info: RepoInfo): string | null {
  if (!info.gitDir) return null;
  const head = readTrim(join(info.gitDir, "HEAD"));
  if (!head) return null;
  const ref = /^ref:\s*(\S+)$/.exec(head)?.[1];
  if (!ref) return /^[0-9a-f]{40,64}$/.test(head) ? head : null;
  const common = info.commonDir ?? info.gitDir;
  const loose = readTrim(join(common, ref)) ?? readTrim(join(info.gitDir, ref));
  if (loose) return loose;
  const packed = readTrim(join(common, "packed-refs")) ?? "";
  const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
  return line ? line.slice(0, line.indexOf(" ")) : null;
}

/** origin/HEAD's target when the clone knows it, else a local main, else master. */
export function defaultBranch(root: string): string | null {
  const remote = gitOut(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (remote) return remote;
  for (const b of ["main", "master"]) {
    if (gitOut(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${b}`])) return b;
  }
  return null;
}

const cachePath = () => join(lbHome(), "cache", "base-rev.json");

function loadCache(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(cachePath(), "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>): void {
  try {
    const keys = Object.keys(cache);
    const kept = Object.fromEntries(keys.slice(-CACHE_LIMIT).map((k) => [k, cache[k] ?? ""]));
    mkdirSync(join(lbHome(), "cache"), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(kept));
  } catch {
    // a lost cache only costs a few spawns on the next hook
  }
}

/**
 * Merge-base of HEAD with the default branch: what this agent's line ranges are relative to.
 * Cached per (repo root, HEAD) because HEAD only moves on commits, so repeats cost a file read.
 */
export function baseRev(info: RepoInfo): string | undefined {
  const sha = headSha(info);
  if (!sha) return undefined;
  const key = `${info.root}|${sha}`;
  const cache = loadCache();
  const hit = cache[key];
  if (hit !== undefined) return hit || undefined;
  const def = defaultBranch(info.root);
  const base = def ? gitOut(info.root, ["merge-base", "HEAD", def]) : null;
  cache[key] = base ?? "";
  saveCache(cache);
  return base ?? undefined;
}

/** The git operation a finished Bash command performed, with the repo state right after it. */
export function gitOpFor(command: string, cwd: string, exitCode: number | undefined): GitOp | undefined {
  const ops = parseGitOps(command);
  const primary = primaryOp(ops);
  if (!primary) return undefined;
  const dir = resolve(cwd, primary.dir);
  const ok = exitCode === 0;
  // --abbrev-ref only applies to the revisions after it: full sha first, then the branch name.
  const [sha, rawBranch] = (gitOut(dir, ["rev-parse", "HEAD", "--abbrev-ref", "HEAD"]) ?? "").split("\n");
  const branch = rawBranch && rawBranch !== "HEAD" ? rawBranch : undefined;
  const commit = ops.find((o) => o.op === "commit");
  const shown =
    ok && commit ? gitOut(resolve(cwd, commit.dir), ["show", "--name-only", "--format=", "HEAD"]) : null;
  const op: GitOp = { op: primary.op, ok, files: (shown ?? "").split("\n").filter(Boolean) };
  if (branch) op.branch = branch;
  if (sha) op.sha = sha;
  const target = opTarget(primary, branch);
  if (target) op.target = target;
  return op;
}
