import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lbHome } from "../config";
import { sha1 } from "../hash";
import type { RepoInfo } from "./git";

export const BACKGROUND_GAP_MS = 2 * 60_000;

/** Reads .git/config instead of spawning `git remote`: this runs inside the Stop hook. */
export function hasOrigin(info: RepoInfo): boolean {
  const dir = info.commonDir ?? info.gitDir;
  if (!dir) return false;
  try {
    return /^\s*\[remote "origin"\]/m.test(readFileSync(join(dir, "config"), "utf8"));
  } catch {
    return false;
  }
}

const stampPath = (root: string) => join(lbHome(), "cache", `merge-check-${sha1(root).slice(0, 16)}`);

/** At most one background merge check per repo per gap; claiming writes the stamp so racing Stops skip. */
export function claimBackgroundSlot(root: string, now: number, gapMs = BACKGROUND_GAP_MS): boolean {
  try {
    const last = Number(readFileSync(stampPath(root), "utf8"));
    if (Number.isFinite(last) && now - last < gapMs) return false;
  } catch {
    // no stamp yet
  }
  try {
    mkdirSync(join(lbHome(), "cache"), { recursive: true });
    writeFileSync(stampPath(root), String(now));
    return true;
  } catch {
    return false;
  }
}

/** Detached child so `git fetch` never delays the hook's response; the child reports on its own. */
export function startBackgroundMergeCheck(info: RepoInfo, sessionId: string, as?: string): boolean {
  const cli = process.argv[1];
  if (!cli || !hasOrigin(info) || !claimBackgroundSlot(info.root, Date.now())) return false;
  try {
    const args = [...process.execArgv, cli, "merge-check", "--repo", info.root, "--session", sessionId];
    if (as) args.push("--as", as);
    // A credential prompt would hang a child nobody can answer.
    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
    };
    const child = spawn(process.execPath, args, { detached: true, stdio: "ignore", cwd: info.root, env });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}
