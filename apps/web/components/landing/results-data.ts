// Measured pilot results for the landing's Results section and the /report page. Sonnet agents, Little Brother
// off vs on, then a merge-and-fix step; ground truth from git and tests. Each report lives at
// apps/evals/results/pilot-1024/<suite>/report.md.

export type Headline = { big: string; what: string };

export const HEADLINES: Headline[] = [
  { big: "−26%", what: "cost per run on larger tasks, with −17% new tokens" },
  { big: "67 → 89%", what: "merged success on larger tasks, after the fix step" },
  {
    big: "−56–62%",
    what: "merges that broke a teammate's tests (STALE-bench, two passes)",
  },
  { big: "−60%", what: "merge conflicts on CooperBench, 5 → 2 of 10" },
  {
    big: "100%",
    what: "detection precision on the planted suite, 88% caught before the first edit",
  },
];

/** Share of runs whose merge broke (merge conflict, or a teammate's tests failing after a clean merge), off vs on. */
export type SuiteBar = { suite: string; off: number; on: number; runs: number };
export const BROKEN_MERGES: SuiteBar[] = [
  { suite: "Larger tasks", off: 67, on: 11, runs: 18 },
  { suite: "Planted suite", off: 27, on: 3, runs: 60 },
  { suite: "STALE-bench pass 1", off: 50, on: 19, runs: 32 },
  { suite: "STALE-bench pass 2", off: 100, on: 44, runs: 32 },
  { suite: "CooperBench", off: 50, on: 20, runs: 20 },
];
