import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pairsFromRun } from "../../../apps/evals/src/export-pairs";
import { RunFile } from "../../../apps/evals/src/run-file";
import {
  type Gold,
  type LabelledPair,
  negativeRelation,
  type Relation,
} from "../../../packages/core/src/index";
import { flag } from "./common";
import { embedAll, geminiKey } from "./embed";
import { designedPairs } from "./eval-design";
import { promptsFor } from "./eval-prompts";
import { runDiffs } from "./eval-worktree";
import { intentPair, lessonNode, planNode } from "./intent-pair";
import { nodeOf, PAIRS_DIR, prPair, tally, writeJsonl } from "./pr-pairs";

// Our live eval runs → gold pairs at three levels: the two agents' plans (as the case planted them), their
// final diffs (from the run's worktrees, labelled by the evidence checks / graded merge), and the stored
// classification rows (export-pairs.ts). Grouped by case, so repeats of one case never straddle a split.
//
//   npx tsx scripts/classifier/datasets/eval-runs.ts --results apps/evals/results/pilot-1024,apps/evals/results/pilot-1024b

type Run = {
  file: string;
  rel: string;
  caseId: string;
  variant: string;
  arm: string;
  suite?: string;
  startedAt: number;
  control: boolean;
  materialized: boolean;
  clash: boolean;
  mergeConflict: boolean;
  touched: Record<string, string[]>;
  raw: unknown;
};

function runFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return runFiles(p);
    return n === "run.json" ? [p] : [];
  });
}

function load(file: string): Run | null {
  const d = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown> & {
    score?: { control: boolean; expectations: { materialized: boolean }[] };
    agents?: { handle: string; startedAt?: number | null; touched?: string[] }[];
    grade?: { clash?: boolean; mergeConflict?: boolean };
  };
  if (d.error || !d.score || !d.agents) return null;
  return {
    file,
    rel: (file.split("/runs/")[1] ?? "").replace(/\/run\.json$/, ""),
    caseId: String(d.caseId),
    variant: String(d.variant ?? "pointed"),
    arm: String(d.arm ?? "on"),
    suite: typeof d.suite === "string" ? d.suite : undefined,
    startedAt: Math.min(...d.agents.map((a) => Number(a.startedAt) || Number.POSITIVE_INFINITY)),
    control: d.score.control,
    materialized: d.score.expectations.some((e) => e.materialized),
    clash: d.grade?.clash === true,
    mergeConflict: d.grade?.mergeConflict === true || d.mergeConflict === true,
    touched: Object.fromEntries(d.agents.map((a) => [a.handle, a.touched ?? []])),
    raw: d,
  };
}

const neg = (f: number[]): Gold => ({ relation: negativeRelation(f), origin: "eval" });
const gold = (relation: Relation): Gold => ({ relation, origin: "eval" });

/** What the agents' final work did, per run: the planted relation if it happened, else nothing. */
function actionLabel(r: Run, planted: Relation | null): Gold | ((f: number[]) => Gold) | null {
  if (r.control) return neg;
  if (r.suite) return r.clash ? gold(r.mergeConflict ? "textual_conflict" : "semantic_conflict") : neg;
  if (planted === "repeats_failure") return r.materialized ? gold(planted) : null;
  return r.materialized && planted ? gold(planted) : neg;
}

async function main(): Promise<void> {
  const dirs = flag(
    process.argv.slice(2),
    "results",
    "apps/evals/results/pilot-1024,apps/evals/results/pilot-1024b",
  );
  const runs = dirs
    .split(",")
    .flatMap((d) => runFiles(resolve(d)))
    .map(load)
    .filter((r): r is Run => r !== null);
  const rows: LabelledPair[] = [];
  const intents = new Map<string, { runs: Run[] }>();
  for (const r of runs) {
    const k = `${r.suite ?? "planted"}|${r.caseId}|${r.variant}`;
    intents.set(k, { runs: [...(intents.get(k)?.runs ?? []), r] });
  }
  const prompts = [...intents.values()].map(({ runs: [r] }) =>
    r ? promptsFor(r.caseId, r.variant, r.suite) : null,
  );
  await embedAll(
    prompts.flatMap((p) => (p ? [`PLAN ${p.first.prompt}`, `PLAN ${p.second.prompt}`] : [])),
    geminiKey(),
  );
  let worktrees = 0;
  for (const { runs: group } of intents.values()) {
    const r0 = group[0];
    const p = r0 ? promptsFor(r0.caseId, r0.variant, r0.suite) : null;
    if (!r0 || !p) continue;
    const caseGroup = `eval:${r0.caseId}`;
    const measured = group.some((r) => r.clash)
      ? group.some((r) => r.clash && r.mergeConflict)
        ? "textual_conflict"
        : "semantic_conflict"
      : null;
    const plannedRel: Relation | null = r0.suite
      ? (measured ?? (r0.control ? null : "overlap_compatible"))
      : p.planted;
    const label = r0.control ? neg : plannedRel ? gold(plannedRel) : null;
    const other =
      p.planted === "repeats_failure"
        ? lessonNode(`${r0.caseId}:lesson`, "a", p.first.prompt, r0.touched[p.first.handle] ?? [], 0)
        : planNode(`${r0.caseId}:${r0.variant}:a`, "a", p.first.prompt, 0);
    const next = planNode(`${r0.caseId}:${r0.variant}:b`, "b", p.second.prompt, 60_000);
    const ip = intentPair(`eval:${r0.caseId}:${r0.variant}:intent`, caseGroup, next, other, label, {
      source: "eval-intent",
      repo: caseGroup,
    });
    if (ip) rows.push(ip);
    for (const r of group) {
      const diffs = runDiffs(r.rel, r.startedAt, p.first.handle, p.second.handle);
      if (!diffs?.b.length) continue;
      const lab = actionLabel(r, p.planted ?? plannedRel);
      if (!lab) continue;
      const meta = { source: "eval-diff", repo: caseGroup, arm: r.arm };
      const at = { a: 0, b: 3_600_000 };
      const row =
        p.planted === "repeats_failure"
          ? intentPair(
              `eval:${r.rel}:diff`,
              caseGroup,
              nodeOf({ id: `${r.rel}:${p.second.handle}`, agentId: "b", files: diffs.b, at: at.b }),
              lessonNode(`${r.rel}:lesson`, "a", p.first.prompt, r.touched[p.first.handle] ?? [], at.a),
              lab,
              meta,
            )
          : diffs.a.length
            ? prPair(
                `eval:${r.rel}:diff`,
                caseGroup,
                { id: `${r.rel}:b`, agentId: "b", files: diffs.b, at: at.b },
                { id: `${r.rel}:a`, agentId: "a", files: diffs.a, at: at.a },
                lab,
                meta,
              )
            : null;
      if (row) {
        rows.push(row);
        worktrees += 1;
      }
    }
    for (const r of group) {
      const parsed = RunFile.safeParse(r.raw);
      if (!parsed.success) continue;
      for (const row of pairsFromRun(parsed.data).rows)
        rows.push({ ...row, group: caseGroup, meta: { ...row.meta, source: "eval-row", repo: caseGroup } });
    }
  }
  rows.push(...designedPairs(new Set(rows.map((r) => r.id))));
  const out = `${PAIRS_DIR}/eval-runs.jsonl`;
  writeJsonl(out, rows);
  const by = (s: string) => tally(rows.filter((x) => x.meta?.source === s));
  console.log(
    `eval runs: ${runs.length} runs, ${intents.size} case×variant → ${rows.length} pairs (${worktrees} from worktrees) → ${out}\n` +
      `  intent ${JSON.stringify(by("eval-intent"))}\n  diff ${JSON.stringify(by("eval-diff"))}\n  rows ${JSON.stringify(by("eval-row"))}`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
