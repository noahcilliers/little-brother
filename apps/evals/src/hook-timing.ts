import { estimateTokens, HookTiming } from "@lb/core";

/** One run's hook cost, read from the agents' LB_TIMING_FILE logs. Times are in-process (see HookTiming). */
export type HookUsage = {
  /** Every PreToolUse call's total ms, kept raw so percentiles pool across runs. */
  preToolUseMs: number[];
  calls: number;
  /** All hooks' wall time: what the agents spent waiting on Little Brother. */
  hookSec: number;
  timeouts: number;
  /** Summed ms per phase over PreToolUse calls; `boot` is runtime init and module loading. */
  prePhasesMs: Record<string, number>;
  /** Estimated tokens of hook output put in front of the model (context, deny reasons). */
  injectedTokens: number;
  /** Estimated tokens the run's catches spared (`classifications.tokensSaved`). */
  tokensSaved: number;
};

/** Parses a JSONL timing log; lines that don't parse (a write cut short) are dropped. */
export function parseTimingLog(text: string): HookTiming[] {
  return text.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      const parsed = HookTiming.safeParse(JSON.parse(line));
      return parsed.success ? [parsed.data] : [];
    } catch {
      return [];
    }
  });
}

export function hookUsage(calls: HookTiming[], tokensSaved: number): HookUsage {
  const pre = calls.filter((c) => c.event === "PreToolUse");
  const prePhasesMs: Record<string, number> = {};
  const add = (k: string, v: number) => {
    prePhasesMs[k] = (prePhasesMs[k] ?? 0) + v;
  };
  for (const c of pre) {
    add("boot", c.bootMs);
    for (const [k, v] of Object.entries(c.phases)) add(k, v);
  }
  return {
    preToolUseMs: pre.map((c) => c.totalMs),
    calls: calls.length,
    hookSec: calls.reduce((n, c) => n + c.totalMs, 0) / 1000,
    timeouts: calls.filter((c) => c.timedOut).length,
    prePhasesMs,
    injectedTokens: estimateTokens(calls.reduce((n, c) => n + c.injectedChars, 0)),
    tokensSaved,
  };
}
