import type { HookUsage } from "./hook-timing";

/** docs/PLAN.md evaluation target: PreToolUse p95 under 150 ms, excluding the async judge. */
export const PRE_TOOL_USE_TARGET_MS = 150;

export type LatencyMetrics = {
  /** Runs that produced timing logs. */
  runs: number;
  calls: number;
  preToolUseCalls: number;
  /** Per-call process cost Node's clock can't see (exec, teardown), measured once and added to every call. */
  spawnOverheadMs: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  /** Share of PreToolUse calls over the target. */
  overTargetRate: number | null;
  timeouts: number;
  /** Mean seconds per run that agents spent waiting on hooks, all events. */
  hookSecPerRun: number | null;
  /** Mean ms per PreToolUse call by phase, largest first. */
  phaseMsPerCall: [string, number][];
  injectedTokens: number;
  tokensSaved: number;
  /** tokensSaved − injectedTokens: what Little Brother returned net of the context it added. */
  netTokens: number;
};

/** Nearest-rank percentile. */
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? null;
}

export function latencyMetrics(usage: HookUsage[], spawnOverheadMs = 0): LatencyMetrics {
  const pre = usage.flatMap((u) => u.preToolUseMs.map((ms) => ms + spawnOverheadMs));
  const calls = usage.reduce((n, u) => n + u.calls, 0);
  const phases = new Map<string, number>();
  for (const u of usage)
    for (const [k, v] of Object.entries(u.prePhasesMs)) phases.set(k, (phases.get(k) ?? 0) + v);
  const injectedTokens = usage.reduce((n, u) => n + u.injectedTokens, 0);
  const tokensSaved = usage.reduce((n, u) => n + u.tokensSaved, 0);
  const hookSec = usage.reduce((n, u) => n + u.hookSec, 0) + (calls * spawnOverheadMs) / 1000;
  return {
    runs: usage.length,
    calls,
    preToolUseCalls: pre.length,
    spawnOverheadMs,
    p50Ms: percentile(pre, 50),
    p95Ms: percentile(pre, 95),
    maxMs: pre.length ? Math.max(...pre) : null,
    overTargetRate: pre.length ? pre.filter((ms) => ms > PRE_TOOL_USE_TARGET_MS).length / pre.length : null,
    timeouts: usage.reduce((n, u) => n + u.timeouts, 0),
    hookSecPerRun: usage.length ? hookSec / usage.length : null,
    phaseMsPerCall: pre.length
      ? [...phases].map(([k, v]): [string, number] => [k, v / pre.length]).sort((a, b) => b[1] - a[1])
      : [],
    injectedTokens,
    tokensSaved,
    netTokens: tokensSaved - injectedTokens,
  };
}
