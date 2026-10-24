// The eval results the "What we measure" scene shows, one beat each, in order. Only measured numbers live here:
// planted and large suites (detection), STALE-bench and CooperBench (Little Brother off vs on, paired runs).
// Update this file when a new run lands; the beats only read it.

export type Bar = { name: string; value: number; shown: string; accent?: boolean };
export type Result = {
  label: string;
  value: number;
  unit: string;
  /** Source and sample, in a few words. */
  note: string;
  bars?: Bar[];
  /** The value a full bar stands for. */
  max?: number;
};

export const RESULTS = {
  precision: {
    label: "Precision",
    value: 100,
    unit: "%",
    note: "0 false positives · planted and large suites",
  },
  recall: {
    label: "Planted clashes caught",
    value: 64,
    unit: "%",
    max: 100,
    bars: [
      { name: "duplicate", value: 86, shown: "86%" },
      { name: "conflict", value: 67, shown: "67%" },
      { name: "stale", value: 33, shown: "33%" },
    ],
    note: "16 of 25 · 9 of 9 on the large suite",
  },
  early: {
    label: "Flagged before the first edit",
    value: 88,
    unit: "%",
    note: "planted suite · median 20 s to detect",
  },
  interference: {
    label: "Merges that broke a teammate's tests",
    value: 19,
    unit: "%",
    max: 100,
    bars: [
      { name: "Little Brother off", value: 50, shown: "50%" },
      { name: "Little Brother on", value: 19, shown: "19%", accent: true },
    ],
    note: "STALE-bench · 16 paired runs",
  },
  conflicts: {
    label: "Runs with a merge conflict",
    value: 2,
    unit: "/10",
    max: 10,
    bars: [
      { name: "Little Brother off", value: 5, shown: "5/10" },
      { name: "Little Brother on", value: 2, shown: "2/10", accent: true },
    ],
    note: "CooperBench · 10 paired runs",
  },
} satisfies Record<string, Result>;
