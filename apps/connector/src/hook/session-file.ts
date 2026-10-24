import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lbHome } from "../config";
import { sha1 } from "../hash";
import { ownAncestors, processAncestors } from "./process-tree";

const PID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionDir(): string {
  if (process.env.LB_SESSION_DIR) return process.env.LB_SESSION_DIR;
  if (process.env.CLAUDE_PLUGIN_DATA) return join(process.env.CLAUDE_PLUGIN_DATA, "sessions");
  return join(lbHome(), "sessions");
}

export function projectKey(projectDir?: string): string {
  return sha1(projectDir ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
}

const pidDir = (): string => join(sessionDir(), "pid");

function readId(path: string): string {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    const id =
      typeof raw === "object" && raw !== null ? (raw as { session_id?: unknown }).session_id : undefined;
    return typeof id === "string" ? id : "";
  } catch {
    return "";
  }
}

/** Dead sessions leave their pid records behind; a week covers any session still running. */
function pruneStale(now: number): void {
  for (const name of readdirSync(pidDir())) {
    const path = join(pidDir(), name);
    if (now - statSync(path).mtimeMs > PID_TTL_MS) rmSync(path, { force: true });
  }
}

/**
 * MCP servers never learn the Claude session id, so SessionStart leaves it for `lb mcp`: under each parent
 * process (the session's own claude process is shared by its hooks and its MCP server), plus a per-folder copy
 * for platforms without ps and for `lb replay`. The folder copy alone mixed up two sessions in one folder.
 */
export function writeSessionId(
  sessionId: string,
  projectDir?: string,
  ancestors: number[] = processAncestors(),
): void {
  const body = JSON.stringify({ session_id: sessionId });
  try {
    mkdirSync(sessionDir(), { recursive: true });
    writeFileSync(join(sessionDir(), `${projectKey(projectDir)}.json`), body);
    if (ancestors.length === 0) return;
    mkdirSync(pidDir(), { recursive: true });
    for (const pid of ancestors) writeFileSync(join(pidDir(), `${pid}.json`), body);
    pruneStale(Date.now());
  } catch {
    // best effort: lb mcp falls back to member+repo on the backend
  }
}

/** The per-folder copy: whichever session in that folder started last. */
export function readSessionId(projectDir?: string): string {
  return readId(join(sessionDir(), `${projectKey(projectDir)}.json`));
}

/** Nearest parent with a record wins, so this process's own claude session beats anything above it. */
export function readSessionIdFor(ancestors: number[]): string {
  for (const pid of ancestors) {
    const id = readId(join(pidDir(), `${pid}.json`));
    if (id) return id;
  }
  return "";
}

/** The Claude session this `lb mcp` belongs to. */
export function ownSessionId(): string {
  return readSessionIdFor(ownAncestors()) || readSessionId();
}
