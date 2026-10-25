import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type DiffFile,
  type Gold,
  type LabelledPair,
  lexicalSimilarity,
  negativeRelation,
  type Relation,
} from "../../../packages/core/src/index";
import { DATASETS } from "./common";
import { cached, type Pr, type PrFile } from "./gh-cache";
import type { Candidate } from "./github-mine";
import { intentPair, lessonNode, planNode } from "./intent-pair";
import { nodeOf, PAIRS_DIR, tally, writeJsonl } from "./pr-pairs";

// Mined GitHub candidates → pairs at the plan level (title + opening of the body) and the code level (diffs).
// repeats_failure pairs put the reverted first attempt in as a failure lesson, as the backend would.
// Negatives: each pooled merged PR against its most similar pooled neighbour in the same repo (the pair the
// vector index would retrieve), labelled independent / overlap_compatible.
//
//   npx tsx scripts/classifier/datasets/github-pairs.ts

const STATUS: Record<string, DiffFile["status"]> = { added: "added", removed: "removed", renamed: "renamed" };
const files = (xs: PrFile[]): DiffFile[] =>
  xs.map((f) => ({ path: f.filename, status: STATUS[f.status] ?? "modified", patch: f.patch ?? "" }));
const plan = (p: Pr) =>
  `${p.title}. ${(p.body ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 300)}`;

function labelled(
  c: Candidate,
  next: Pr,
  other: Pr,
  nf: PrFile[] | null,
  of: PrFile[] | null,
): LabelledPair[] {
  const relation = c.kind as Relation;
  const gold: Gold = { relation, origin: "dataset" };
  const group = `github:${c.repo}`;
  const meta = { source: `github-${c.kind}`, repo: group };
  const id = `gh:${c.repo}#${c.next}-${c.other}`;
  const out: (LabelledPair | null)[] = [];
  const stale = c.kind === "repeats_failure";
  const otherIntent = stale
    ? lessonNode(
        `${id}:lesson`,
        "a",
        `${other.title} (reverted)`,
        (of ?? []).map((f) => f.filename).slice(0, 5),
        0,
      )
    : planNode(`${id}:pa`, "a", plan(other), 0);
  out.push(
    intentPair(`${id}:intent`, group, planNode(`${id}:pb`, "b", plan(next), 60_000), otherIntent, gold, {
      ...meta,
      level: "intent",
    }),
  );
  if (nf?.length && of?.length) {
    const nextAction = nodeOf({
      id: `${id}:b`,
      agentId: "b",
      files: files(nf),
      at: 3_600_000,
      text: `EDIT ${next.title}`,
    });
    const otherAction = stale
      ? {
          ...nodeOf({ id: `${id}:a`, agentId: "a", files: files(of), at: 0, text: `EDIT ${other.title}` }),
          outcome: "failed" as const,
        }
      : nodeOf({ id: `${id}:a`, agentId: "a", files: files(of), at: 0, text: `EDIT ${other.title}` });
    out.push(intentPair(`${id}:diff`, group, nextAction, otherAction, gold, { ...meta, level: "action" }));
  }
  return out.filter((x): x is LabelledPair => x !== null);
}

function negatives(pool: Candidate[]): LabelledPair[] {
  const out: LabelledPair[] = [];
  const byRepo = new Map<string, Pr[]>();
  for (const c of pool) {
    const p = cached<Pr>(`repos/${c.repo}/pulls/${c.next}`);
    if (p) byRepo.set(c.repo, [...(byRepo.get(c.repo) ?? []), p]);
  }
  for (const [repo, prs] of byRepo) {
    for (const p of prs) {
      const nearest = prs
        .filter((q) => q.number !== p.number)
        .map((q) => ({ q, s: lexicalSimilarity(plan(p), plan(q)) }))
        .sort((a, b) => b.s - a.s)[0];
      if (!nearest || nearest.q.number > p.number) continue;
      const id = `gh:${repo}#${p.number}~${nearest.q.number}`;
      const row = intentPair(
        `${id}:intent`,
        `github:${repo}`,
        planNode(`${id}:pb`, "b", plan(p), 60_000),
        planNode(`${id}:pa`, "a", plan(nearest.q), 0),
        (f: number[]) => ({ relation: negativeRelation(f), origin: "dataset" }),
        { source: "github-negative", repo: `github:${repo}`, level: "intent" },
      );
      if (row) out.push(row);
    }
  }
  return out;
}

function main(): void {
  const cands = readFileSync(join(DATASETS, "github", "candidates.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Candidate)
    // Concurrent miner passes can append the same candidate twice.
    .filter((c, i, all) => all.findIndex((d) => `${d.kind}|${d.repo}|${d.next}|${d.other}` === `${c.kind}|${c.repo}|${c.next}|${c.other}`) === i);
  const rows: LabelledPair[] = [];
  for (const c of cands.filter((x) => x.kind !== "pool" && x.other !== undefined)) {
    const next = cached<Pr>(`repos/${c.repo}/pulls/${c.next}`);
    const other = cached<Pr>(`repos/${c.repo}/pulls/${c.other}`);
    if (!next || !other) continue;
    const f = (n: number | undefined) => cached<PrFile[]>(`repos/${c.repo}/pulls/${n}/files?per_page=100`);
    rows.push(...labelled(c, next, other, f(c.next), f(c.other)));
  }
  rows.push(...negatives(cands.filter((c) => c.kind === "pool")));
  const out = join(PAIRS_DIR, "github.jsonl");
  writeJsonl(out, rows);
  console.log(
    `github: ${cands.length} candidates → ${rows.length} pairs ${JSON.stringify(tally(rows))} → ${out}`,
  );
}

main();
