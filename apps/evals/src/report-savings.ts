import type { ArmStats, SavingsSummary } from "./measured-savings";

const tok = (x: number | null): string => {
  if (x === null) return "–";
  const r = Math.round(x);
  const abs = Math.abs(r);
  return `${r < 0 ? "−" : ""}${abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs}`;
};
const usd = (x: number | null): string =>
  x === null ? "–" : `${x < 0 ? "−" : ""}$${Math.abs(x).toFixed(2)}`;
const pct = (x: number | null): string => (x === null ? "–" : `${Math.round(x * 100)}%`);

/** "12k ± 4k", flagged when the gap is under two standard errors and could be run-to-run noise. */
function measured(m: number | null, se: number | null): string {
  if (m === null) return "–";
  if (se === null) return tok(m);
  return `${tok(m)} ± ${tok(se)}${Math.abs(m) < 2 * se ? " (noise)" : ""}`;
}

const clash = (off: ArmStats, on: ArmStats): string =>
  off.clashRate === null && on.clashRate === null ? "–" : `${pct(off.clashRate)} / ${pct(on.clashRate)}`;

/** The report's "Measured savings" section; empty unless some runs had Little Brother off. */
export function savingsSection(s: SavingsSummary | undefined): string[] {
  if (!s) return [];
  if (!s.rows.length)
    return ["## Measured savings", "", "No case and variant has scored runs in both arms.", ""];
  const t = s.total;
  return [
    "## Measured savings",
    "",
    "Measured = mean tokens per run with Little Brother off minus with it on (± one standard error). " +
      "Estimated = the catches' `tokensSaved` on the on runs. Tokens are new tokens (input + output + cache " +
      "writes), the same definition `tokensSaved` uses; dollars also include cache reads. Clash = share of " +
      "planted clashes whose evidence checks passed, off / on. Totals are per pass (one run of each case " +
      "and variant below), so they don't match Hook overhead, which adds up every run.",
    "",
    "| | Tokens | Cost |",
    "| --- | --- | --- |",
    `| Measured saved | ${measured(t.measuredTokens, t.measuredSe)} | ${usd(t.measuredUsd)} |`,
    `| Estimated saved | ${tok(t.estimatedTokens)} | – |`,
    `| Estimated net (− injected) | ${tok(t.estimatedNetTokens)} | – |`,
    "",
    "| Case | Variant | Runs off / on | Tokens off | Tokens on | Measured | Estimated | Cost off | Cost on | Clash |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...s.rows
      .map((r) =>
        [
          `\`${r.caseId}\``,
          r.variant,
          `${r.off.runs} / ${r.on.runs}`,
          tok(r.off.tokens),
          tok(r.on.tokens),
          measured(r.measuredTokens, r.measuredSe),
          tok(r.estimatedTokens),
          usd(r.off.costUsd),
          usd(r.on.costUsd),
          clash(r.off, r.on),
        ].join(" | "),
      )
      .map((line) => `| ${line} |`),
    "",
  ];
}

/** Rows for the compare table; a side with no off runs shows "–". */
export function savingsCompareRows(baseline?: SavingsSummary, current?: SavingsSummary): string[] {
  const rows: [string, (t: SavingsSummary["total"]) => number | null][] = [
    ["Measured saved per pass", (t) => t.measuredTokens],
    ["Estimated saved per pass", (t) => t.estimatedTokens],
  ];
  if (!baseline && !current) return [];
  return rows.map(([label, get]) => {
    const a = baseline ? get(baseline.total) : null;
    const b = current ? get(current.total) : null;
    const d = a === null || b === null ? null : b - a;
    const change = d === null ? "–" : d === 0 ? "=" : `${d > 0 ? "+" : "−"}${tok(Math.abs(d))}`;
    return `| ${label} | ${tok(a)} | ${tok(b)} | ${change} |`;
  });
}
