import type { ArmComparison, ArmSummary } from "./arm-stats";
import type { PairedStat } from "./paired";

const k = (x: number): string => {
  const abs = Math.abs(x);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${Math.round(abs)}`;
  return `${x < 0 ? "−" : ""}${s}`;
};
const usd = (x: number): string => `${x < 0 ? "−" : ""}$${Math.abs(x).toFixed(2)}`;
const secs = (x: number): string => `${x < 0 ? "−" : ""}${Math.round(Math.abs(x))} s`;
const pct = (x: number | null): string => (x === null ? "–" : `${Math.round(x * 100)}%`);

/** "12.3k ± 1.1k"; a difference under two standard errors is marked as noise. */
export function stat(s: PairedStat, f: (x: number) => string, diff = false): string {
  if (s.mean === null) return "–";
  if (s.se === null) return f(s.mean);
  const noise = diff && Math.abs(s.mean) < 2 * s.se ? " (noise)" : "";
  return `${f(s.mean)} ± ${f(s.se)}${noise}`;
}

const ROWS: [string, (a: ArmSummary) => string][] = [
  ["Runs (errors)", (a) => `${a.runs} (${a.errors})`],
  ["New tokens / run", (a) => stat(a.tokens, k)],
  ["Cache reads / run", (a) => stat(a.cacheRead, k)],
  ["$ / run (Claude Code estimate)", (a) => stat(a.costUsd, usd)],
  ["Wall time / run", (a) => stat(a.wallSec, secs)],
  ["Final success", (a) => (a.finalSuccessN ? `${pct(a.finalSuccess)} (n=${a.finalSuccessN})` : "–")],
  ["Clash happened", (a) => pct(a.clashRate)],
  ["Merge conflict", (a) => pct(a.mergeConflictRate)],
  [
    "Detection recall / precision",
    (a) => (a.recall === null && a.precision === null ? "–" : `${pct(a.recall)} / ${pct(a.precision)}`),
  ],
  ["Caught before first edit", (a) => pct(a.beforeEditRate)],
  ["Median time to catch", (a) => (a.medianDetectSec === null ? "–" : `${a.medianDetectSec.toFixed(1)} s`)],
  ["Distinct catches / run", (a) => (a.catchesPerRun === null ? "–" : a.catchesPerRun.toFixed(1))],
];

/** Off vs on per-run means, then paired differences (off − on; success is on − off). */
export function armsSection(title: string, c: ArmComparison): string[] {
  const p = c.paired;
  return [
    `## ${title}: Little Brother off vs on`,
    "",
    "Means per run ± one standard error. New tokens = input + output + cache writes; cache reads are " +
      "listed separately. Totals include the fix-up agent when it ran.",
    "",
    "| | Off | On |",
    "| --- | --- | --- |",
    ...ROWS.map(([label, f]) => `| ${label} | ${f(c.off)} | ${f(c.on)} |`),
    "",
    ...(p.pairs
      ? [
          `Paired differences over ${p.pairs} off/on pair(s) (same case, variant and repetition): ` +
            "positive means Little Brother saved (or, for success, helped).",
          "",
          "| | Mean difference ± SE |",
          "| --- | --- |",
          `| New tokens saved | ${stat(p.tokens, k, true)} |`,
          `| Cache reads saved | ${stat(p.cacheRead, k, true)} |`,
          `| $ saved | ${stat(p.costUsd, usd, true)} |`,
          `| Wall time saved | ${stat(p.wallSec, secs, true)} |`,
          `| Final success gained | ${stat(p.success, (x) => `${Math.round(x * 100)} pt`, true)} |`,
          "",
        ]
      : []),
  ];
}
