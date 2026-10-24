import { appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { type HookTiming, hookDecision, injectedText } from "@lb/core";

/** Wall time per phase of one hook call. Only created when LB_TIMING_FILE is set (evals, benchmarks). */
export type PhaseTimer = {
  /** Adds the time since the previous mark to `phase`; repeated phases accumulate. */
  mark(phase: string): void;
  readonly phases: Record<string, number>;
  /** Node start to timer creation: runtime init, module loading, argument parsing. */
  readonly bootMs: number;
};

export function startTimer(): PhaseTimer {
  const phases: Record<string, number> = {};
  const bootMs = performance.now();
  let last = bootMs;
  return {
    phases,
    bootMs,
    mark(phase) {
      const now = performance.now();
      phases[phase] = (phases[phase] ?? 0) + now - last;
      last = now;
    },
  };
}

export type TimedOutcome = {
  raw: string;
  output: unknown;
  delivered: boolean;
  timedOut: boolean;
  error?: string;
};

const ms = (x: number): number => Math.round(x * 10) / 10;

function ids(raw: string): { tool?: string; sessionId?: string } {
  try {
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== "object") return {};
    const { tool_name, session_id } = o as Record<string, unknown>;
    return {
      ...(typeof tool_name === "string" ? { tool: tool_name } : {}),
      ...(typeof session_id === "string" ? { sessionId: session_id } : {}),
    };
  } catch {
    return {};
  }
}

/** Appends one JSON line. Never throws: timing must not change what the hook does. */
export function writeTiming(file: string, event: string, timer: PhaseTimer, o: TimedOutcome): void {
  try {
    const decision = hookDecision(o.output);
    const record: HookTiming = {
      event,
      ...ids(o.raw),
      at: Math.round(performance.timeOrigin),
      totalMs: ms(performance.now()),
      bootMs: ms(timer.bootMs),
      phases: Object.fromEntries(Object.entries(timer.phases).map(([k, v]) => [k, ms(v)])),
      delivered: o.delivered,
      timedOut: o.timedOut,
      ...(o.error ? { error: o.error.slice(0, 200) } : {}),
      injectedChars: injectedText(o.output).length,
      ...(decision ? { decision } : {}),
    };
    appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch {
    // a timing write that fails loses one sample, nothing else
  }
}
