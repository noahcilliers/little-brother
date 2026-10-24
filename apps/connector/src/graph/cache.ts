import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RepoGraph } from "@lb/core";
import { lbHome } from "../config";
import { sha1 } from "../hash";

const BUILD_LOCK_MS = 10 * 60_000;
const KEEP_PER_REPO = 3;

const dir = (): string => join(lbHome(), "cache", "graph");
const repoKey = (root: string): string => sha1(root).slice(0, 16);
export const graphPath = (root: string, head: string): string => join(dir(), `${repoKey(root)}-${head}.json`);

/** The graph built at this HEAD, or null; a corrupt or foreign file counts as missing. */
export function cachedGraph(root: string, head: string): RepoGraph | null {
  try {
    const parsed = RepoGraph.safeParse(JSON.parse(readFileSync(graphPath(root, head), "utf8")));
    return parsed.success && parsed.data.head === head ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Atomic write, then drop this repo's older graphs so the cache stays a few files per repo. */
export function writeGraph(root: string, graph: RepoGraph): void {
  mkdirSync(dir(), { recursive: true });
  const path = graphPath(root, graph.head);
  writeFileSync(`${path}.tmp`, JSON.stringify(graph));
  renameSync(`${path}.tmp`, path);
  const prefix = `${repoKey(root)}-`;
  const mine = readdirSync(dir())
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => ({ f, at: statSync(join(dir(), f)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  for (const old of mine.slice(KEEP_PER_REPO)) rmSync(join(dir(), old.f), { force: true });
}

/** One build per repo and HEAD at a time: the lock is a timestamp file, stale after ten minutes. */
function claimBuild(root: string, head: string, now: number): boolean {
  const lock = `${graphPath(root, head)}.lock`;
  try {
    const at = Number(readFileSync(lock, "utf8"));
    if (Number.isFinite(at) && now - at < BUILD_LOCK_MS) return false;
  } catch {
    // no lock yet
  }
  try {
    mkdirSync(dir(), { recursive: true });
    writeFileSync(lock, String(now));
    return true;
  } catch {
    return false;
  }
}

export function releaseBuild(root: string, head: string): void {
  rmSync(`${graphPath(root, head)}.lock`, { force: true });
}

/** Detached `lb graph-build`, so parsing the repo never delays a hook; the next SessionStart sends it. */
export function startBackgroundGraphBuild(root: string, head: string): boolean {
  const cli = process.argv[1];
  if (!cli || !claimBuild(root, head, Date.now())) return false;
  try {
    const args = [...process.execArgv, cli, "graph-build", "--repo", root, "--head", head];
    const child = spawn(process.execPath, args, { detached: true, stdio: "ignore", cwd: root });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}
