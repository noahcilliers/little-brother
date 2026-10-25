import { appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { type HookTiming, hookDecision, injectedText } from "@lb/core";
import { runHook } from "../hook/run";
import type { PhaseTimer } from "../hook/timing";

/** Fires one Claude-Code-shaped hook in-process and returns its output; null when off, unjoined or failed. */
export type HookBridge = (event: string, fields?: Record<string, unknown>) => Promise<unknown>;

export type BridgeOptions = {
  enabled: boolean;
  sessionId: string;
  cwd: string;
  transcriptPath: string;
  /** Lets Stop start the detached merge check, as `lb hook` does; tests leave it off. */
  background?: boolean;
  /** LB_TIMING_FILE: one HookTiming line per call, as `lb hook` writes, timed in-process (no boot cost). */
  timingFile?: string;
  onError?: (event: string, error: string) => void;
};

// Mirrors the plugin's hook matchers, so the backend gets exactly the events a Claude Code session sends.
export const PRE_TOOL_HOOK = new Set(["Edit", "Write", "MultiEdit", "Bash"]);
export const POST_TOOL_HOOK = new Set(["Edit", "Write", "MultiEdit", "Bash", "Read", "Grep", "Glob"]);
export const FAILURE_HOOK = new Set(["Bash"]);

// runHook bounds its own network calls; this only guards against something hanging outright.
const GUARD_MS = 10_000;

function timer(): PhaseTimer {
  const phases: Record<string, number> = {};
  let last = performance.now();
  return {
    phases,
    bootMs: 0,
    mark(phase) {
      const now = performance.now();
      phases[phase] = (phases[phase] ?? 0) + now - last;
      last = now;
    },
  };
}

function writeTiming(file: string, record: HookTiming): void {
  try {
    appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch {
    // a lost timing sample changes nothing the agent does
  }
}

/** Hooks fail open: an error, a timeout or a backend that's down all read as "no output". */
export function hookBridge(o: BridgeOptions): HookBridge {
  return async (event, fields = {}) => {
    if (!o.enabled) return null;
    const input = {
      session_id: o.sessionId,
      transcript_path: o.transcriptPath,
      cwd: o.cwd,
      hook_event_name: event,
      ...fields,
    };
    const t = timer();
    const start = performance.now();
    try {
      const guard = new Promise<null>((r) => setTimeout(() => r(null), GUARD_MS).unref());
      const res = await Promise.race([
        runHook(event, input, { background: o.background === true, timer: t }),
        guard,
      ]);
      if (res?.error) o.onError?.(event, res.error);
      if (o.timingFile) {
        const decision = hookDecision(res?.output);
        writeTiming(o.timingFile, {
          event,
          ...(typeof fields.tool_name === "string" ? { tool: fields.tool_name } : {}),
          sessionId: o.sessionId,
          at: Date.now(),
          totalMs: Math.round((performance.now() - start) * 10) / 10,
          bootMs: 0,
          phases: Object.fromEntries(Object.entries(t.phases).map(([k, v]) => [k, Math.round(v * 10) / 10])),
          delivered: res?.delivered ?? false,
          timedOut: res === null,
          ...(res?.error ? { error: res.error.slice(0, 200) } : {}),
          injectedChars: injectedText(res?.output).length,
          ...(decision ? { decision } : {}),
        });
      }
      return res?.output ?? null;
    } catch (e) {
      o.onError?.(event, e instanceof Error ? e.message : String(e));
      return null;
    }
  };
}
