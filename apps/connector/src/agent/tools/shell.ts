import { spawn } from "node:child_process";
import { capText } from "./paths";
import type { ToolOutcome } from "./types";

const TIMEOUT_MS = 120_000;
const MAX_STREAM = 200_000;
const MAX_SHOWN = 30_000;

/** Collects a stream up to a cap, keeping the tail once it overflows (errors print last). */
function collector(): { push(b: Buffer): void; text(): string } {
  let buf = "";
  return {
    push(b) {
      buf += b.toString("utf8");
      if (buf.length > MAX_STREAM) buf = buf.slice(-MAX_STREAM);
    },
    text: () => buf,
  };
}

/**
 * Runs in its own process group so a timeout kills the whole tree (a test runner's workers too). stdin is
 * closed: a command waiting for input fails at once instead of hanging until the timeout.
 */
export function bashTool(cwd: string, command: string, timeoutMs = TIMEOUT_MS): Promise<ToolOutcome> {
  return new Promise((resolve) => {
    const out = collector();
    const err = collector();
    let interrupted = false;
    let settled = false;
    const child = spawn("bash", ["-c", command], { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", out.push);
    child.stderr.on("data", err.push);
    const timer = setTimeout(() => {
      interrupted = true;
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    const finish = (code: number | null, spawnError?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const exit = interrupted ? 124 : (code ?? 1);
      const stdout = out.text();
      const stderr = spawnError ?? err.text();
      const shown = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n");
      const note = interrupted
        ? `\n[timed out after ${timeoutMs / 1000} s]`
        : exit !== 0
          ? `\n[exit code ${exit}]`
          : "";
      resolve({
        ok: exit === 0,
        text: `${capText(shown, MAX_SHOWN) || "(no output)"}${note}`,
        response: { stdout, stderr, interrupted, exit_code: exit, isImage: false },
      });
    };
    child.on("error", (e) => finish(127, e.message));
    child.on("close", (code) => finish(code));
  });
}
