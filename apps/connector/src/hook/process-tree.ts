import { spawnSync } from "node:child_process";
import { basename } from "node:path";

export type ProcessRow = { ppid: number; comm: string };

const MAX_DEPTH = 8;

/** `ps -A -o pid=,ppid=,comm=` output; comm may hold spaces (macOS app bundle paths). */
export function parsePsTable(out: string): Map<number, ProcessRow> {
  const rows = new Map<number, ProcessRow>();
  for (const line of out.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (m?.[1] && m[2]) rows.set(Number(m[1]), { ppid: Number(m[2]), comm: (m[3] ?? "").trim() });
  }
  return rows;
}

/**
 * Parents of `pid`, nearest first, ending at the first `claude` process. Hooks and `lb mcp` are both children
 * of their session's claude process, and everything above it (a terminal, the desktop app) is shared by other
 * sessions, so it is left out. Without a claude process in sight (npm installs run as `node`) the whole capped
 * chain is returned and readers rely on taking the nearest match.
 */
export function ancestorsOf(pid: number, rows: Map<number, ProcessRow>): number[] {
  const out: number[] = [];
  let at = rows.get(pid)?.ppid;
  while (at !== undefined && at > 1 && out.length < MAX_DEPTH && !out.includes(at)) {
    out.push(at);
    const row = rows.get(at);
    if (!row || basename(row.comm) === "claude") break;
    at = row.ppid;
  }
  return out;
}

/** One `ps` spawn; empty where ps is missing (Windows), so callers fall back to the per-folder file. */
export function processAncestors(pid: number = process.pid): number[] {
  if (process.platform === "win32") return [];
  try {
    const r = spawnSync("ps", ["-A", "-o", "pid=,ppid=,comm="], {
      encoding: "utf8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return r.status === 0 ? ancestorsOf(pid, parsePsTable(r.stdout)) : [];
  } catch {
    return [];
  }
}

let own: number[] | undefined;

/** A long-lived process's parents never change, so `lb mcp` pays for ps once. */
export function ownAncestors(): number[] {
  own ??= processAncestors();
  return own;
}
