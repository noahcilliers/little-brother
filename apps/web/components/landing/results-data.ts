// Measured pilot results for the landing's Results section and the /report page. Sonnet agents, Little Brother
// off vs on, then a merge-and-fix step; ground truth from git and tests. Each report lives at
// apps/evals/results/pilot-1024/<suite>/report.md.

export const EVALS_URL = "https://github.com/noahcilliers/little-brother/tree/main/docs/evals";

export type Headline = { big: string; what: string; sample: string };

export const HEADLINES: Headline[] = [
  { big: "−26%", what: "cost per run on larger tasks, with −17% new tokens", sample: "pilot · 18 runs" },
  { big: "67 → 89%", what: "merged success on larger tasks, after the fix step", sample: "pilot · 18 runs" },
  {
    big: "−56–62%",
    what: "merges that broke a teammate's tests (STALE-bench, two passes)",
    sample: "pilot · 64 runs",
  },
  { big: "−60%", what: "merge conflicts on CooperBench, 5 → 2 of 10", sample: "pilot · 20 runs" },
  {
    big: "100%",
    what: "detection precision on the planted suite, 88% caught before the first edit",
    sample: "pilot · 60 runs",
  },
];

/** The four strongest numbers, for the compact strip. */
export const STRIP: Headline[] = [HEADLINES[0], HEADLINES[1], HEADLINES[2], HEADLINES[4]].filter(
  (h): h is Headline => h !== undefined,
);

/** Share of runs whose merge broke (merge conflict, or a teammate's tests failing after a clean merge), off vs on. */
export type SuiteBar = { suite: string; metric: string; off: number; on: number; runs: number };
export const BROKEN_MERGES: SuiteBar[] = [
  { suite: "Larger tasks", metric: "merge conflict", off: 67, on: 11, runs: 18 },
  { suite: "Planted suite", metric: "merge conflict", off: 27, on: 3, runs: 60 },
  { suite: "STALE-bench pass 1", metric: "broke a teammate's tests", off: 50, on: 19, runs: 32 },
  { suite: "STALE-bench pass 2", metric: "broke a teammate's tests", off: 100, on: 44, runs: 32 },
  { suite: "CooperBench", metric: "merge conflict", off: 50, on: 20, runs: 20 },
];
