import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CASES } from "../../../apps/evals/cases";
import { HELPERS, type Mechanism, taskA, taskB } from "../../../apps/evals/src/suites/stale-specs";
import { prDescription } from "../../../apps/evals/src/suites/trac";
import type { Relation } from "../../../packages/core/src/index";
import { DATASETS } from "./common";

// The two agents' prompts for an eval run, rebuilt the way the harness built them (cases/, suites/), with
// the clash the case plants. Read-only: nothing here clones, fetches or installs.

const BENCH = join(DATASETS, "..", "benchmarks");
export type Prompts = {
  first: { handle: string; prompt: string };
  second: { handle: string; prompt: string };
};
export type Planted = Prompts & { planted: Relation | null; control: boolean };

const TYPE_RELATION: Record<string, Relation> = {
  duplicate: "duplicate",
  conflict: "textual_conflict",
  stale: "repeats_failure",
};

function plantedCase(caseId: string, variant: string): Planted | null {
  const c = CASES.find((x) => x.id === caseId);
  const [a, b] = c?.agents ?? [];
  if (!c || !a || !b) return null;
  const v = variant === "natural" ? "natural" : "pointed";
  const e = c.expect[0];
  return {
    first: { handle: a.handle, prompt: a.prompt[v] },
    second: { handle: b.handle, prompt: b.prompt[v] },
    planted: e ? (e.relation ?? TYPE_RELATION[e.type] ?? null) : null,
    control: c.expect.length === 0,
  };
}

function cooperCase(caseId: string): Planted | null {
  const m = /^([a-z_]+)\/(\d+)\/(\d+)\+(\d+)$/.exec(caseId);
  if (!m) return null;
  const md = (n: string | undefined) => {
    const f = join(BENCH, "CooperBench", "dataset", m[1] ?? "", `task${m[2]}`, `feature${n}`, "feature.md");
    return existsSync(f) ? readFileSync(f, "utf8").trim() : null;
  };
  const [a, b] = [md(m[3]), md(m[4])];
  // Features of one PR are planted as a possible clash; whether it happened is measured per run.
  return a && b
    ? {
        first: { handle: "leo", prompt: a },
        second: { handle: "priya", prompt: b },
        planted: null,
        control: false,
      }
    : null;
}

type RealStale = { id: string; symbol: string; mechanism: Mechanism; task_B: string };
type Meta = { title: string; body?: string | null };

function staleCase(caseId: string): Planted | null {
  const dir = join(BENCH, "STALE-bench");
  const specs = readFileSync(join(dir, "results", "realstale_batch.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RealStale);
  const spec = specs.find((s) => s.id === caseId);
  if (spec) {
    const helper = HELPERS[spec.symbol.split(".").pop() ?? ""];
    if (!helper) return null;
    return {
      first: { handle: "noah", prompt: taskA(helper, spec.mechanism) },
      second: { handle: "ash", prompt: taskB(helper, spec.task_B) },
      planted: "semantic_conflict",
      control: false,
    };
  }
  const prs = /^django__(\d+)_(\d+)$/.exec(caseId);
  if (!prs) return null;
  const desc = (n: string | undefined) => {
    const f = join(dir, "patches", "django", `pr${n}`, "meta.json");
    if (!existsSync(f)) return null;
    const meta = JSON.parse(readFileSync(f, "utf8")) as Meta;
    return prDescription(meta.title, meta.body ?? "");
  };
  const [a, b] = [desc(prs[1]), desc(prs[2])];
  return a && b
    ? {
        first: { handle: "noah", prompt: a },
        second: { handle: "ash", prompt: b },
        planted: null,
        control: false,
      }
    : null;
}

export function promptsFor(caseId: string, variant: string, suite?: string): Planted | null {
  if (suite === "cooper") return cooperCase(caseId);
  if (suite === "stale") return staleCase(caseId);
  return plantedCase(caseId, variant);
}
