import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { geminiJudge } from "../../../packages/backend/convex/classify/adapters/gemini";
import {
  type Direction,
  type LabelledPair,
  type Relation,
  scoreCandidates,
  tokens,
} from "../../../packages/core/src/index";
import { DATASETS, flag, pool } from "./common";
import { geminiKey } from "./embed";
import { type SearchItem, search } from "./gh-cache";
import { REPOS } from "./github-mine";
import { intentPair, planNode, similarityOf } from "./intent-pair";
import { PAIRS_DIR, tally, writeJsonl } from "./pr-pairs";

// TEACHER labels (weight 0.3) for intent_contradiction, which has no clean gold source: PR titles in one repo
// that take something away ("remove / deprecate / drop / disable X") paired with ones that build the same thing
// up ("add / support / extend / enable X"), plus matched controls (two "add" plans on shared nouns). Each pair
// is labelled by our own Gemini judge adapter; verdicts are cached, and the teacher source is recorded.
//
//   npx tsx scripts/classifier/datasets/contradiction-teacher.ts [--per-repo 12]

const NEG_Q = "in:title remove OR deprecate OR drop OR disable";
const POS_Q = "in:title add OR support OR extend OR enable";
const VERDICTS = join(DATASETS, "teacher", "gemini-verdicts.json");
const COMMON = new Set([
  "fix",
  "fixes",
  "update",
  "support",
  "add",
  "remove",
  "for",
  "the",
  "and",
  "when",
  "option",
]);

const nouns = (t: string) => new Set([...tokens(t)].filter((w) => !COMMON.has(w)));
const shared = (a: string, b: string) => [...nouns(a)].filter((w) => nouns(b).has(w)).length;

type Verdict = { relation: Relation; direction: Direction; confidence: number; latencyMs: number };
type Cand = { repo: string; a: SearchItem; b: SearchItem; kind: "opposed" | "control" };

function pairUp(repo: string, neg: SearchItem[], pos: SearchItem[], perRepo: number): Cand[] {
  const best = (xs: SearchItem[], ys: SearchItem[], kind: Cand["kind"], n: number) =>
    xs
      .flatMap((a) =>
        ys.filter((b) => b.number !== a.number).map((b) => ({ a, b, s: shared(a.title, b.title) })),
      )
      .filter((x) => x.s >= 2)
      .sort((x, y) => y.s - x.s)
      .slice(0, n)
      .map(({ a, b }) => ({ repo, a, b, kind }));
  return [...best(neg, pos, "opposed", perRepo), ...best(pos, pos, "control", Math.ceil(perRepo / 2))];
}

async function main(): Promise<void> {
  const perRepo = Number(flag(process.argv.slice(2), "per-repo", "12"));
  const key = geminiKey();
  if (!key) throw new Error("no GEMINI_API_KEY (env or local deployment)");
  const judge = geminiJudge(key);
  const cache: Record<string, unknown> = existsSync(VERDICTS)
    ? JSON.parse(readFileSync(VERDICTS, "utf8"))
    : {};
  const cands: Cand[] = [];
  for (const repo of REPOS) {
    const isPr = (i: SearchItem) => i.pull_request !== undefined;
    const neg = (await search(`repo:${repo} is:pr ${NEG_Q}`)).filter(isPr);
    const pos = (await search(`repo:${repo} is:pr ${POS_Q}`)).filter(isPr);
    cands.push(...pairUp(repo, neg, pos, perRepo));
  }
  const rows: LabelledPair[] = [];
  await pool(cands, 4, async (c) => {
    const id = `teacher:${c.repo}#${c.a.number}~${c.b.number}`;
    const next = planNode(`${id}:b`, "b", c.a.title, 60_000);
    const other = planNode(`${id}:a`, "a", c.b.title, 0);
    const [pair] = scoreCandidates(next, [
      { node: other, failedMemory: false, similarity: similarityOf(next.text, other.text) },
    ]);
    if (!pair) return;
    if (!(id in cache)) {
      const started = Date.now();
      const v = await judge.judge(pair, [], []).catch(() => null);
      cache[id] = v
        ? {
            relation: v.relation,
            direction: v.direction,
            confidence: v.confidence,
            latencyMs: Date.now() - started,
          }
        : null;
    }
    const v = cache[id] as Verdict | null;
    if (!v) return;
    const row = intentPair(
      id,
      `github:${c.repo}`,
      next,
      other,
      null,
      { source: "teacher-contradiction", repo: `github:${c.repo}`, teacherSource: "gemini", mined: c.kind },
      {
        teacher: { relation: v.relation, direction: v.direction, confidence: v.confidence, source: "llm" },
        judge: { relation: v.relation, confidence: v.confidence, latencyMs: v.latencyMs },
      },
    );
    if (row) rows.push(row);
  });
  mkdirSync(join(DATASETS, "teacher"), { recursive: true });
  writeFileSync(VERDICTS, JSON.stringify(cache));
  const out = join(PAIRS_DIR, "teacher-contradiction.jsonl");
  writeJsonl(out, rows);
  const byTeacher: Record<string, number> = {};
  for (const r of rows)
    byTeacher[r.teacher?.relation ?? "?"] = (byTeacher[r.teacher?.relation ?? "?"] ?? 0) + 1;
  console.log(
    `teacher: ${cands.length} candidates → ${rows.length} judged ${JSON.stringify(byTeacher)} ${JSON.stringify(tally(rows))} → ${out}`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
