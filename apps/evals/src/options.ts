import { parseArgs } from "node:util";
import type { Variant } from "./case";

export type Options = {
  cases: string[];
  variants: Variant[];
  runs: number;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  timeoutMin: number;
  concurrency: number;
  settleSec: number;
  site: string;
  out?: string;
  compare?: string;
  build: boolean;
  list: boolean;
};

export const USAGE = `pnpm --filter @lb/evals eval [options]

  --cases a,b        case ids or id prefixes (default: all)
  --variant v        pointed | natural | both (default: both)
  --runs n           repetitions per case and variant (default: 3)
  --model m          agent model (default: sonnet)
  --max-turns n      per agent (default: 30)
  --max-budget usd   per agent (default: 1.5)
  --timeout-min n    per agent wall clock (default: 12)
  --concurrency n    case runs at once (default: 2)
  --settle s         wait after the last agent exits before reading results (default: 20)
  --site url         Convex site URL (default: $LB_SITE_URL or http://127.0.0.1:3211)
  --out dir          results directory (default: apps/evals/results/<timestamp>)
  --compare dir      earlier results directory to diff against
  --no-build         skip building the connector
  --list             print the cases and exit`;

function num(v: string | undefined, fallback: number, name: string): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number`);
  return n;
}

export function parseOptions(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      cases: { type: "string" },
      variant: { type: "string" },
      runs: { type: "string" },
      model: { type: "string" },
      "max-turns": { type: "string" },
      "max-budget": { type: "string" },
      "timeout-min": { type: "string" },
      concurrency: { type: "string" },
      settle: { type: "string" },
      site: { type: "string" },
      out: { type: "string" },
      compare: { type: "string" },
      "no-build": { type: "boolean" },
      list: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const variant = values.variant ?? "both";
  if (!["pointed", "natural", "both"].includes(variant))
    throw new Error("--variant must be pointed, natural or both");
  return {
    cases: values.cases
      ? values.cases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    variants: variant === "both" ? ["pointed", "natural"] : [variant as Variant],
    runs: Math.round(num(values.runs, 3, "runs")),
    model: values.model ?? "sonnet",
    maxTurns: Math.round(num(values["max-turns"], 30, "max-turns")),
    maxBudgetUsd: num(values["max-budget"], 1.5, "max-budget"),
    timeoutMin: num(values["timeout-min"], 12, "timeout-min"),
    concurrency: Math.round(num(values.concurrency, 2, "concurrency")),
    settleSec: num(values.settle, 20, "settle"),
    site: (values.site ?? process.env.LB_SITE_URL ?? "http://127.0.0.1:3211").replace(/\/+$/, ""),
    ...(values.out ? { out: values.out } : {}),
    ...(values.compare ? { compare: values.compare } : {}),
    build: !values["no-build"],
    list: values.list ?? false,
  };
}
