import type { Metrics, RunRecord, Summary } from "./aggregate";
import { armOf } from "./arm";
import { armsSection } from "./report-arms";
import { latencySection } from "./report-latency";
import { savingsSection } from "./report-savings";

export type ReportMeta = {
  startedAt: string;
  model: string;
  variants: string[];
  /** Missing in reports from before arms existed (Little Brother on only). */
  arms?: string[];
  runsPerCase: number;
  backend: string;
  wallSec: number;
};

const pct = (x: number | null): string => (x === null ? "–" : `${Math.round(x * 100)}%`);
const sec = (x: number | null): string => (x === null ? "–" : `${x.toFixed(1)} s`);

const METRIC_ROWS: [string, (m: Metrics) => string][] = [
  ["Recall (caught, any kind)", (m) => pct(m.recall)],
  ["Strict recall (right kind)", (m) => pct(m.strictRecall)],
  ["Precision", (m) => pct(m.precision)],
  ["Kind accuracy", (m) => pct(m.kindAccuracy)],
  ["Flagged before first edit", (m) => pct(m.beforeEditRate)],
  ["Median time to detect", (m) => sec(m.medianDetectSec)],
  ["Hits / mislabels / misses", (m) => `${m.hits} / ${m.mislabels} / ${m.misses}`],
  ["Didn't materialize", (m) => String(m.unmaterialized)],
  ["False positives", (m) => String(m.falsePositives)],
  ["Noisy control runs", (m) => (m.controlRuns ? `${m.noisyControlRuns} / ${m.controlRuns}` : "–")],
];

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

function metricTable(columns: [string, Metrics][]): string {
  return table(
    ["", ...columns.map(([name]) => name)],
    METRIC_ROWS.map(([label, f]) => [label, ...columns.map(([, m]) => f(m))]),
  );
}

function details(runs: RunRecord[]): string[] {
  const out: string[] = [];
  const tag = (r: RunRecord) =>
    `\`${r.caseId}\` ${r.variant}${armOf(r) === "off" ? " LB-off" : ""} #${r.run}`;
  for (const r of runs) {
    if (r.error) {
      out.push(`- ${tag(r)} · harness error: ${r.error}`);
      continue;
    }
    if (armOf(r) === "off") continue;
    for (const e of r.score.expectations) {
      const pair = e.agents.join(" + ");
      if (e.outcome === "miss") out.push(`- ${tag(r)} · **miss**: ${e.type} on ${pair}, the clash happened`);
      if (e.outcome === "mislabel")
        out.push(
          `- ${tag(r)} · **mislabel**: expected ${e.type} on ${pair}, got ${e.row?.type} (${e.row?.relation})`,
        );
    }
    for (const fp of r.score.falsePositives)
      out.push(
        `- ${tag(r)} · **false positive**: ${fp.types.join("/")} on ${fp.agents.join(" + ")}: ${fp.reason}`,
      );
  }
  return out;
}

export function renderReport(meta: ReportMeta, s: Summary, runs: RunRecord[]): string {
  const variantCols = Object.entries(s.byVariant).map(([v, m]) => [v, m] as [string, Metrics]);
  const caseTable = table(
    ["Case", "Variant", "Runs", "Hit", "Mislabel", "Miss", "Didn't happen", "FP", "Errors"],
    s.cases.map((c) => [
      `\`${c.caseId}\``,
      c.variant,
      String(c.runs),
      String(c.hits),
      String(c.mislabels),
      String(c.misses),
      String(c.unmaterialized),
      String(c.falsePositives),
      String(c.errors),
    ]),
  );
  const notes = details(runs);
  return [
    `# Little Brother eval · ${meta.startedAt}`,
    "",
    `Model **${meta.model}** · variants ${meta.variants.join(", ")} · ` +
      `${meta.arms?.includes("off") ? `Little Brother ${meta.arms.join(" + ")} · ` : ""}` +
      `${meta.runsPerCase} run(s) per case · ` +
      `cost $${s.costUsd.toFixed(2)} · wall ${(meta.wallSec / 60).toFixed(1)} min`,
    "",
    `Backend: ${meta.backend}`,
    "",
    "## Detection",
    "",
    metricTable([
      ["Overall", s.overall],
      ["Duplicate", s.byType.duplicate],
      ["Conflict", s.byType.conflict],
      ["Stale", s.byType.stale],
    ]),
    "",
    "## By prompt variant",
    "",
    metricTable(variantCols),
    "",
    ...(s.arms ? armsSection("Planted suite", s.arms) : []),
    ...latencySection(s.latency),
    ...savingsSection(s.savings),
    "## Cases",
    "",
    caseTable,
    "",
    "## Misses, mislabels, false positives",
    "",
    notes.length ? notes.join("\n") : "None.",
    "",
  ].join("\n");
}
