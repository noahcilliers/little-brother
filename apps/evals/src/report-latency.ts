import { type LatencyMetrics, PRE_TOOL_USE_TARGET_MS } from "./latency";

const ms = (x: number | null): string => (x === null ? "–" : `${Math.round(x)} ms`);
const tokens = (x: number): string => (Math.abs(x) >= 10_000 ? `${(x / 1000).toFixed(0)}k` : String(x));
const pct = (x: number | null): string => (x === null ? "–" : `${Math.round(x * 100)}%`);

/** The report's "Hook overhead" section: what the hooks cost the agents in time and context. */
export function latencySection(m: LatencyMetrics | undefined): string[] {
  if (!m || m.preToolUseCalls === 0)
    return ["## Hook overhead", "", "No hook timing logs (connector built before LB_TIMING_FILE?).", ""];
  const p95 = m.p95Ms ?? 0;
  const verdict = p95 < PRE_TOOL_USE_TARGET_MS ? "meets" : "**misses**";
  const phases = m.phaseMsPerCall.map(([k, v]) => `${k} ${Math.round(v)}`).join(" · ");
  const rows: [string, string][] = [
    ["PreToolUse calls", String(m.preToolUseCalls)],
    ["PreToolUse p50 / p95 / max", `${ms(m.p50Ms)} / ${ms(m.p95Ms)} / ${ms(m.maxMs)}`],
    [`Over ${PRE_TOOL_USE_TARGET_MS} ms`, pct(m.overTargetRate)],
    ["Mean ms per PreToolUse call, by phase", phases || "–"],
    ["Hook calls (all events) / watchdog timeouts", `${m.calls} / ${m.timeouts}`],
    [
      "Agent time waiting on hooks, per run",
      m.hookSecPerRun === null ? "–" : `${m.hookSecPerRun.toFixed(1)} s`,
    ],
    ["Tokens injected by hooks (est.)", tokens(m.injectedTokens)],
    ["Tokens saved by catches (est.)", tokens(m.tokensSaved)],
    ["Net tokens (saved − injected)", tokens(m.netTokens)],
  ];
  return [
    "## Hook overhead",
    "",
    `PreToolUse p95 ${ms(m.p95Ms)} ${verdict} the ${PRE_TOOL_USE_TARGET_MS} ms target. Times include ` +
      `${m.spawnOverheadMs} ms per call of process spawn, measured on this machine at idle, so they can ` +
      "run low under heavy concurrency.",
    "",
    "| | |",
    "| --- | --- |",
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
    "",
  ];
}

type Row = [string, (m: LatencyMetrics) => number | null, "ms" | "s" | "tok"];

const ROWS: Row[] = [
  ["PreToolUse p50", (m) => m.p50Ms, "ms"],
  ["PreToolUse p95", (m) => m.p95Ms, "ms"],
  ["Hook wait per run", (m) => m.hookSecPerRun, "s"],
  ["Tokens injected (est.)", (m) => m.injectedTokens, "tok"],
  ["Tokens saved (est.)", (m) => m.tokensSaved, "tok"],
  ["Net tokens (est.)", (m) => m.netTokens, "tok"],
];

const fmt = (v: number | null, kind: Row[2]): string =>
  v === null ? "–" : kind === "ms" ? ms(v) : kind === "s" ? `${v.toFixed(1)} s` : tokens(Math.round(v));

/** Rows for the compare table; a baseline from before hook timing shows "–". */
export function latencyCompareRows(baseline?: LatencyMetrics, current?: LatencyMetrics): string[] {
  return ROWS.map(([label, get, kind]) => {
    const a = baseline?.preToolUseCalls ? get(baseline) : null;
    const b = current?.preToolUseCalls ? get(current) : null;
    const d = a === null || b === null ? null : b - a;
    const change = d === null ? "–" : d === 0 ? "=" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d), kind)}`;
    return `| ${label} | ${fmt(a, kind)} | ${fmt(b, kind)} | ${change} |`;
  });
}
