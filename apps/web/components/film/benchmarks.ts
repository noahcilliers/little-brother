// Every number the "What we measure" scenes show, in one place so real results can replace targets and
// placeholders without touching the scenes. `status` decides the small tag next to the number:
// measured → no tag, target → "target", placeholder → "pending".

export type Status = "measured" | "target" | "placeholder";
export type Point = { name: string; value: number };
export type Benchmark = {
  label: string;
  value: number;
  unit: string;
  status: Status;
  /** Printed before the number: "<", ">", "≈" or "−". */
  bound?: string;
  /** Other systems or conditions to compare against, drawn as bars. */
  baselines?: Point[];
  baselineStatus?: Status;
  /** Pieces that add up to the value, drawn as a stacked bar. */
  parts?: Point[];
};

export const BENCH = {
  precision: {
    // Live off/on eval, 5 planted cases × 2 runs: 10 catches, 0 false positives. Small sample; target stays >90%.
    label: "Precision on blocking verdicts · planted suite",
    value: 100,
    unit: "%",
    bound: "",
    status: "measured",
    baselines: [
      { name: "LLM judges every event", value: 70 },
      { name: "Embedding similarity only", value: 55 },
      { name: "Path overlap only", value: 40 },
    ],
    baselineStatus: "placeholder",
  },
  catches: { label: "Clashes caught before the first edit", value: 10, unit: "/ 10", status: "measured" },
  latency: {
    label: "PreToolUse p95 · 3 agents active",
    value: 150,
    unit: "ms",
    bound: "<",
    status: "target",
    parts: [
      { name: "normalize", value: 5 },
      { name: "index reads", value: 40 },
      { name: "verdict read", value: 20 },
    ],
    baselines: [{ name: "LLM on the edit path", value: 4000 }],
    baselineStatus: "placeholder",
  },
  tokensControlled: {
    label: "Tokens per run · off vs on",
    value: 30,
    unit: "%",
    bound: "−",
    status: "placeholder",
    baselines: [
      { name: "off", value: 100 },
      { name: "on", value: 70 },
    ],
    baselineStatus: "placeholder",
  },
  tokensReplay: {
    // Per-catch estimate; the off/on eval showed it overcounting, so it stays pending until measured.
    label: "Saved by catches · estimate",
    value: 8.5,
    unit: "k tokens",
    bound: "≈",
    status: "placeholder",
  },
  cost: {
    label: "$ per run · off vs on",
    value: 20,
    unit: "%",
    bound: "−",
    status: "placeholder",
    baselines: [
      { name: "off", value: 1 },
      { name: "on", value: 0.8 },
    ],
    baselineStatus: "placeholder",
  },
} satisfies Record<string, Benchmark>;

export const TAG: Record<Status, string | null> = {
  measured: null,
  target: "target",
  placeholder: "pending",
};
