import type { Metrics, Summary } from "./aggregate";

const KEYS: [keyof Metrics, string, "pct" | "sec" | "n"][] = [
  ["recall", "Recall", "pct"],
  ["strictRecall", "Strict recall", "pct"],
  ["precision", "Precision", "pct"],
  ["kindAccuracy", "Kind accuracy", "pct"],
  ["beforeEditRate", "Before first edit", "pct"],
  ["medianDetectSec", "Median detect", "sec"],
  ["falsePositives", "False positives", "n"],
];

function fmt(v: number | null, kind: "pct" | "sec" | "n"): string {
  if (v === null) return "–";
  if (kind === "pct") return `${Math.round(v * 100)}%`;
  if (kind === "sec") return `${v.toFixed(1)} s`;
  return String(v);
}

function delta(a: number | null, b: number | null, kind: "pct" | "sec" | "n"): string {
  if (a === null || b === null) return "–";
  const d = b - a;
  if (d === 0) return "=";
  const sign = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  return kind === "pct"
    ? `${sign}${Math.round(abs * 100)} pt`
    : kind === "sec"
      ? `${sign}${abs.toFixed(1)} s`
      : `${sign}${abs}`;
}

/** Markdown diff of two summaries: headline metrics, then cases whose hits or false positives moved. */
export function renderCompare(baseline: Summary, current: Summary): string {
  const rows = KEYS.map(([k, label, kind]) => {
    const a = baseline.overall[k] as number | null;
    const b = current.overall[k] as number | null;
    return `| ${label} | ${fmt(a, kind)} | ${fmt(b, kind)} | ${delta(a, b, kind)} |`;
  });
  const before = new Map(baseline.cases.map((c) => [`${c.caseId} ${c.variant}`, c]));
  const moved = current.cases.flatMap((c) => {
    const b = before.get(`${c.caseId} ${c.variant}`);
    if (!b || (b.hits === c.hits && b.falsePositives === c.falsePositives && b.misses === c.misses))
      return [];
    return [
      `- \`${c.caseId}\` ${c.variant}: hits ${b.hits}→${c.hits}, misses ${b.misses}→${c.misses}, FP ${b.falsePositives}→${c.falsePositives}`,
    ];
  });
  return [
    "## Compared with baseline",
    "",
    "| Metric | Baseline | Now | Change |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    moved.length ? moved.join("\n") : "No case changed.",
    "",
  ].join("\n");
}
