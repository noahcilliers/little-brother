// The eval results the "What we measure" scene shows, one beat each, in order. Only measured numbers live here,
// all pilot runs (Sonnet agents, Little Brother off vs on, then a merge-and-fix step), from
// apps/evals/results/pilot-1024/<suite>/report.md. Update this file when a new run lands; the beats only read it.

export type Bar = { name: string; value: number; shown: string; accent?: boolean };
export type Result = {
  label: string;
  /** Printed before the number, e.g. "−". */
  pre?: string;
  value: number;
  unit: string;
  /** Source and sample, in a few words. */
  note: string;
  bars?: Bar[];
  /** The value a full bar stands for. */
  max?: number;
};

export const RESULTS = {
  cost: {
    label: "Cost per run · larger tasks",
    pre: "−",
    value: 26,
    unit: "%",
    max: 0.35,
    bars: [
      { name: "Little Brother off", value: 0.35, shown: "$0.35" },
      { name: "Little Brother on", value: 0.26, shown: "$0.26", accent: true },
    ],
    note: "pilot · 18 runs",
  },
  tokens: {
    label: "New tokens per run · larger tasks",
    pre: "−",
    value: 17,
    unit: "%",
    max: 42.3,
    bars: [
      { name: "Little Brother off", value: 42.3, shown: "42.3k" },
      { name: "Little Brother on", value: 35.1, shown: "35.1k", accent: true },
    ],
    note: "pilot · 18 runs",
  },
  success: {
    label: "Merged success after the fix step · larger tasks",
    value: 89,
    unit: "%",
    max: 100,
    bars: [
      { name: "Little Brother off", value: 67, shown: "67%" },
      { name: "Little Brother on", value: 89, shown: "89%", accent: true },
    ],
    note: "pilot · 18 runs · small sample",
  },
  interference: {
    label: "Merges that broke a teammate's tests, cut by",
    value: 56,
    unit: "–62%",
    max: 100,
    bars: [
      { name: "pass 1 · off", value: 50, shown: "50%" },
      { name: "pass 1 · on", value: 19, shown: "19%", accent: true },
      { name: "pass 2 · off", value: 100, shown: "100%" },
      { name: "pass 2 · on", value: 44, shown: "44%", accent: true },
    ],
    note: "pilot · 64 runs · STALE-bench constructed interface changes",
  },
  conflicts: {
    label: "Merge conflicts · CooperBench",
    pre: "−",
    value: 60,
    unit: "%",
    max: 10,
    bars: [
      { name: "Little Brother off", value: 5, shown: "5 of 10" },
      { name: "Little Brother on", value: 2, shown: "2 of 10", accent: true },
    ],
    note: "pilot · 20 runs · small sample",
  },
  precision: {
    label: "Detection precision",
    value: 100,
    unit: "%",
    note: "pilot · 60 runs · 0 false positives · 88% flagged before the first edit",
  },
} satisfies Record<string, Result>;

/** One number from the rerun; `before` is the same measure from the batch that found the bugs, when known. */
export type RerunStat = { label: string; before: number | null; after: number | null; unit: string };

/**
 * The rerun after tonight's fixes (deny-once, calls inside f-strings, two new functions in one file). Empty until
 * it lands: the benchmark beat (runs-why.tsx) shows a stat only once its `after` is set, and its `before` only when
 * that is set too. Fill from apps/evals/results/<batch>/<suite>/report.md; the scene needs no change.
 */
export const RERUN: { batch: string | null; note: string | null; stats: RerunStat[] } = {
  batch: "STALE-bench · Haiku agents",
  note: "before: 10 of 19 caught · after: 46 of 48 across four passes",
  stats: [
    { label: "STALE-bench recall", before: 53, after: 96, unit: "%" },
    { label: "Mislabelled catches", before: 5, after: 0, unit: "" },
  ],
};
