import type { TokenCounts } from "@lb/core";
import { type Arm, armOf } from "./arm";
import type { FindingType, Variant } from "./case";
import type { HookUsage } from "./hook-timing";
import { type LatencyMetrics, latencyMetrics } from "./latency";
import { measuredSavings, type SavingsSummary } from "./measured-savings";
import type { RunScore } from "./score";

export type RunRecord = {
  caseId: string;
  variant: Variant;
  /** Missing on runs from before arms existed, which all had Little Brother on. */
  arm?: Arm;
  run: number;
  score: RunScore;
  costUsd: number;
  /** Every agent's API usage summed. Missing on runs from before token totals existed. */
  tokens?: TokenCounts;
  wallSec: number;
  /** Missing on runs from before hook timing existed. */
  hooks?: HookUsage;
  /** Set when the run could not be scored (harness error); such runs are excluded from metrics. */
  error?: string;
};

export type Metrics = {
  expected: number;
  hits: number;
  mislabels: number;
  misses: number;
  unmaterialized: number;
  falsePositives: number;
  /** (hits + mislabels) / (hits + mislabels + misses): conflicts caught, whatever they were called. */
  recall: number | null;
  /** hits / (hits + mislabels + misses): caught and called the right kind. */
  strictRecall: number | null;
  /** Pair groups on expected pairs / all pair groups. */
  precision: number | null;
  kindAccuracy: number | null;
  medianDetectSec: number | null;
  /** Share of caught clashes flagged before the later agent's first edit. */
  beforeEditRate: number | null;
  controlRuns: number;
  noisyControlRuns: number;
};

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? null) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** Metrics over runs; `type` limits expectations to one kind and leaves false positives out. */
export function metrics(runs: RunRecord[], type?: FindingType): Metrics {
  const scored = runs.filter((r) => !r.error);
  const exps = scored.flatMap((r) => r.score.expectations).filter((e) => !type || e.type === type);
  const count = (o: string) => exps.filter((e) => e.outcome === o).length;
  const hits = count("hit");
  const mislabels = count("mislabel");
  const misses = count("miss");
  const caught = exps.filter((e) => e.outcome === "hit" || e.outcome === "mislabel");
  const falsePositives = type ? 0 : scored.reduce((n, r) => n + r.score.falsePositives.length, 0);
  const controls = type ? [] : scored.filter((r) => r.score.control);
  return {
    expected: exps.length,
    hits,
    mislabels,
    misses,
    unmaterialized: count("unmaterialized"),
    falsePositives,
    recall: ratio(hits + mislabels, hits + mislabels + misses),
    strictRecall: ratio(hits, hits + mislabels + misses),
    precision: type ? null : ratio(hits + mislabels, hits + mislabels + falsePositives),
    kindAccuracy: ratio(hits, hits + mislabels),
    medianDetectSec: median(caught.flatMap((e) => (e.detectSec === undefined ? [] : [e.detectSec]))),
    beforeEditRate: ratio(caught.filter((e) => e.beforeFirstEdit === true).length, caught.length),
    controlRuns: controls.length,
    noisyControlRuns: controls.filter((r) => r.score.falsePositives.length > 0).length,
  };
}

export type CaseRow = {
  caseId: string;
  variant: Variant;
  runs: number;
  errors: number;
  hits: number;
  mislabels: number;
  misses: number;
  unmaterialized: number;
  falsePositives: number;
};

export function caseRows(runs: RunRecord[]): CaseRow[] {
  const keys = [...new Set(runs.map((r) => `${r.caseId}\u0000${r.variant}`))];
  return keys.map((key) => {
    const [caseId = "", variant = "pointed"] = key.split("\u0000") as [string, Variant];
    const group = runs.filter((r) => r.caseId === caseId && r.variant === variant);
    const m = metrics(group);
    return {
      caseId,
      variant,
      runs: group.length,
      errors: group.filter((r) => r.error).length,
      hits: m.hits,
      mislabels: m.mislabels,
      misses: m.misses,
      unmaterialized: m.unmaterialized,
      falsePositives: m.falsePositives,
    };
  });
}

export type Summary = {
  overall: Metrics;
  byType: Record<FindingType, Metrics>;
  byVariant: Partial<Record<Variant, Metrics>>;
  cases: CaseRow[];
  /** Both arms. */
  costUsd: number;
  /** Missing in summaries from before hook timing existed. */
  latency?: LatencyMetrics;
  /** Present when some runs had Little Brother off. */
  savings?: SavingsSummary;
};

/** Detection and latency describe Little Brother, so they read only runs that had it on. */
export function summarize(all: RunRecord[], spawnOverheadMs = 0): Summary {
  const runs = all.filter((r) => armOf(r) === "on");
  const variants = [...new Set(runs.map((r) => r.variant))];
  const savings = measuredSavings(all);
  return {
    overall: metrics(runs),
    byType: {
      duplicate: metrics(runs, "duplicate"),
      conflict: metrics(runs, "conflict"),
      stale: metrics(runs, "stale"),
    },
    byVariant: Object.fromEntries(variants.map((v) => [v, metrics(runs.filter((r) => r.variant === v))])),
    cases: caseRows(runs),
    costUsd: all.reduce((n, r) => n + r.costUsd, 0),
    latency: latencyMetrics(
      runs.flatMap((r) => (r.error || !r.hooks ? [] : [r.hooks])),
      spawnOverheadMs,
    ),
    ...(savings ? { savings } : {}),
  };
}
