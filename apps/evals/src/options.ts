import { parseArgs } from "node:util";
import { type AgentSpec, parseAgentSpec } from "./agent-spec";
import { ARMS, type Arm } from "./arm";
import type { Variant } from "./case";

export type Suite = "planted" | "stale" | "cooper";
export const SUITES: readonly Suite[] = ["planted", "stale", "cooper"];

export type Options = {
  cases: string[];
  variants: Variant[];
  arms: Arm[];
  runs: number;
  model: string;
  /** Claude Code, or `lb agent` with a Gemini or OpenAI-compatible model (agent-spec.ts). */
  agent: AgentSpec;
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
  /** Integration agent on the merged tree after every run, both arms (fixup.ts). */
  fixup: boolean;
  /** Keep run workspaces after grading (they are deleted by default). */
  keepWorkspaces: boolean;
  /** Off and on runs scheduled in adjacent seeded blocks (paired.ts). */
  paired: boolean;
  seed: number;
  /** Stop starting runs once the ledger's estimated spend reaches this. */
  capUsd: number;
  ledger?: string;
  suite: Suite;
  /** Re-grade an earlier results directory's fix-up trees and rewrite its summary and report (recheck.ts). */
  recheck?: string;
  /** Convert an earlier results directory into labelled training pairs and exit (export-pairs.ts). */
  exportPairs?: string;
};

export const USAGE = `pnpm --filter @lb/evals eval [options]

  --cases a,b        case ids or id prefixes (default: all)
  --variant v        pointed | natural | both (default: both)
  --arm a            on | off | both, or a list of off,on,msg,oracle: msg = shared mailbox, no Little
                     Brother (CooperBench's cooperative baseline); oracle = STALE-bench's informed note (default: on)
  --runs n           repetitions per case, variant and arm (default: 3)
  --model m          agent model (default: sonnet)
  --agent a          claude | lb:gemini:<model> | lb:openai:<model>@<baseUrl>: Claude Code or lb agent (default: claude)
  --max-turns n      per agent (default: 30)
  --max-budget usd   per agent (default: 1.5)
  --timeout-min n    per agent wall clock (default: 12)
  --concurrency n    case runs at once (default: 2)
  --settle s         wait after the last agent exits before reading results (default: 20)
  --site url         Convex site URL (default: $LB_SITE_URL or http://127.0.0.1:3211)
  --out dir          results directory (default: apps/evals/results/<timestamp>)
  --compare dir      earlier results directory to diff against
  --no-build         skip building the connector
  --suite s          planted (demo shop) | stale (STALE-bench Django) | cooper (CooperBench) (default: planted)
  --keep-workspaces  keep each run's repo and worktrees after grading (default: delete, keep results only)
  --no-fixup         skip the integration agent that repairs the merged tree after each run
  --paired           schedule off/on runs in adjacent seeded blocks and report paired differences
  --seed n           schedule seed for --paired (default: 1)
  --cap-usd usd      stop starting runs once estimated spend reaches this (default: 60)
  --ledger file      spend ledger shared across invocations (default: apps/evals/results/ledger.jsonl)
  --recheck dir      re-grade an earlier results dir's fix-up trees against the current cases, then re-report
  --list             print the cases and exit
  --export-pairs dir write <dir>/pairs.jsonl (labelled pairs for the pair model) from a results dir and exit`;

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
      arm: { type: "string" },
      runs: { type: "string" },
      model: { type: "string" },
      agent: { type: "string" },
      "max-turns": { type: "string" },
      "max-budget": { type: "string" },
      "timeout-min": { type: "string" },
      concurrency: { type: "string" },
      settle: { type: "string" },
      site: { type: "string" },
      out: { type: "string" },
      compare: { type: "string" },
      "no-build": { type: "boolean" },
      "no-fixup": { type: "boolean" },
      "keep-workspaces": { type: "boolean" },
      paired: { type: "boolean" },
      seed: { type: "string" },
      "cap-usd": { type: "string" },
      ledger: { type: "string" },
      suite: { type: "string" },
      recheck: { type: "string" },
      list: { type: "boolean" },
      "export-pairs": { type: "string" },
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
  const suite = values.suite ?? "planted";
  if (!SUITES.includes(suite as Suite)) throw new Error(`--suite must be ${SUITES.join(", ")}`);
  const arm = values.arm ?? "on";
  const arms: Arm[] = arm === "both" ? ["off", "on"] : (arm.split(",").map((a) => a.trim()) as Arm[]);
  if (!arms.length || arms.some((a) => !ARMS.includes(a)))
    throw new Error(`--arm must be both or a list of ${ARMS.join(", ")}`);
  return {
    cases: values.cases
      ? values.cases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    variants: variant === "both" ? ["pointed", "natural"] : [variant as Variant],
    arms,
    runs: Math.round(num(values.runs, 3, "runs")),
    model: values.model ?? "sonnet",
    agent: parseAgentSpec(values.agent ?? "claude"),
    maxTurns: Math.round(num(values["max-turns"], 30, "max-turns")),
    maxBudgetUsd: num(values["max-budget"], 1.5, "max-budget"),
    timeoutMin: num(values["timeout-min"], 12, "timeout-min"),
    concurrency: Math.round(num(values.concurrency, 2, "concurrency")),
    settleSec: num(values.settle, 20, "settle"),
    site: (values.site ?? process.env.LB_SITE_URL ?? "http://127.0.0.1:3211").replace(/\/+$/, ""),
    ...(values.out ? { out: values.out } : {}),
    ...(values.compare ? { compare: values.compare } : {}),
    build: !values["no-build"],
    fixup: !values["no-fixup"],
    keepWorkspaces: values["keep-workspaces"] ?? false,
    paired: values.paired ?? false,
    seed: Math.round(num(values.seed, 1, "seed")),
    capUsd: num(values["cap-usd"], 60, "cap-usd"),
    ...(values.ledger ? { ledger: values.ledger } : {}),
    suite: suite as Suite,
    ...(values.recheck ? { recheck: values.recheck } : {}),
    list: values.list ?? false,
    ...(values["export-pairs"] ? { exportPairs: values["export-pairs"] } : {}),
  };
}
