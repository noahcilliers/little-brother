// Numbers for /report, each with the repo file it comes from. Pilot results: apps/evals/results/pilot-1024/<suite>/
// report.md. Classifier: scripts/classifier/results/2026-10-24-real.md and 2026-10-24-learning-curve.md.

export const SRC = {
  large: "apps/evals/results/pilot-1024/large/report.md",
  planted: "apps/evals/results/pilot-1024/planted/report.md",
  stale1: "apps/evals/results/pilot-1024/stale/report.md",
  stale2: "apps/evals/results/pilot-1024/stale-2/report.md",
  cooper: "apps/evals/results/pilot-1024/cooper/report.md",
  model: "scripts/classifier/results/2026-10-24-real.md",
  curve: "scripts/classifier/results/2026-10-24-learning-curve.md",
} as const;

export const REPO = "https://github.com/noahcilliers/little-brother/blob/main/";

export type Suite = {
  id: string;
  name: string;
  runs: number;
  what: string;
  src: keyof typeof SRC;
  rows: [metric: string, off: string, on: string][];
};

// biome-ignore format: one suite per block, rows as a table
export const SUITES: Suite[] = [
  {
    id: "large", name: "Larger tasks", runs: 18, src: "large",
    what: "Multi-file features with a planted clash; nine off/on pairs.",
    rows: [
      ["New tokens / run", "42.3k", "35.1k"], ["$ / run", "$0.35", "$0.26"], ["Final merged success", "67%", "89%"],
      ["Runs with a merge conflict", "67%", "11%"], ["Detection precision / recall", "–", "100% / 100%"],
      ["Caught before the first edit", "–", "89%"],
    ],
  },
  {
    id: "planted", name: "Planted suite", runs: 60, src: "planted",
    what: "Two agents per case with a deliberate duplicate, conflict or stale path; pointed and natural prompts.",
    rows: [
      ["New tokens / run", "28.0k", "27.7k"], ["$ / run", "$0.18", "$0.18"], ["Final merged success", "93%", "100%"],
      ["Runs with a merge conflict", "27%", "3%"], ["Detection precision / recall", "–", "100% / 64%"],
      ["Caught before the first edit", "–", "88%"], ["Median time to detect", "–", "20.4 s"],
    ],
  },
  {
    id: "stale", name: "STALE-bench, constructed interface changes", runs: 64, src: "stale1",
    what: "One agent changes an interface another reuses; two passes of 16 off/on pairs.",
    rows: [
      ["Interference (passes alone, breaks merged), pass 1", "50%", "19%"],
      ["Interference, pass 2", "100%", "44%"],
      ["Own task solved alone, pass 1 / 2", "88% / 94%", "72% / 66%"],
      ["New tokens / run, pass 1 / 2", "20.2k / 22.9k", "21.6k / 24.7k"],
    ],
  },
  {
    id: "cooper", name: "CooperBench", runs: 20, src: "cooper",
    what: "Paired feature tasks on real Python repos; ten off/on pairs. Within noise.",
    rows: [
      ["Merge conflicts", "5 of 10", "2 of 10"], ["Merged success", "50%", "60%"],
      ["New tokens / run", "25.8k", "26.5k"], ["$ / run", "$0.18", "$0.18"],
    ],
  },
];

// biome-ignore format: tabular data
export const RELATIONS: [relation: string, precision: string, recall: string, f1: string, support: number][] = [
  ["overlap_compatible", "0.77", "0.85", "0.81", 922],
  ["textual_conflict", "0.79", "0.71", "0.75", 710],
  ["semantic_conflict", "–", "0.00", "–", 37],
];

// biome-ignore format: tabular data
export const ARCHITECTURES: [name: string, precision: string, recall: string, judge: string, latency: string][] = [
  ["Rules only", "0.63", "0.95", "0.00", "0.05 ms"],
  ["Pair model only", "0.79", "0.68", "0.00", "0.07 ms"],
  ["Cascade (rules → model → judge)", "0.63", "0.95", "0.03", "193 ms"],
];
