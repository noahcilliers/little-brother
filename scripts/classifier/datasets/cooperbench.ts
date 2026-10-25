import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type LabelledPair, parseUnifiedDiff } from "../../../packages/core/src/index";
import { DATASETS } from "./common";
import { embedAll, geminiKey } from "./embed";
import { intentPair, planNode } from "./intent-pair";
import { PAIRS_DIR, prPair, tally, writeJsonl } from "./pr-pairs";

// CooperBench (arXiv 2601.13295): each task is one real PR split into features with gold patches. Its
// gold_conflict_report.json records `git merge` of every pair of gold feature patches: 499 of 652 conflict.
// Action pairs: the two gold patches, textual_conflict or overlap_compatible. Intent pairs: the two feature
// descriptions, overlap_compatible (separate features of one PR, meant to be combined).
//
//   npx tsx scripts/classifier/datasets/cooperbench.ts

const DIR = join(DATASETS, "..", "benchmarks", "CooperBench", "dataset");
type Result = {
  repo: string;
  task_id: number;
  f1: number;
  f2: number;
  has_conflict: boolean;
  error: string | null;
};

const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : null);
const title = (md: string) => (/\*\*Title\*\*:\s*(.+)/.exec(md)?.[1] ?? md.split("\n")[0] ?? "").trim();
const summary = (md: string) => {
  const t = title(md);
  const desc = /\*\*Description\*\*:?\s*([\s\S]{0,300})/.exec(md)?.[1] ?? "";
  return `${t}. ${desc.replace(/\s+/g, " ").trim()}`;
};

async function main(): Promise<void> {
  const report = JSON.parse(readFileSync(join(DIR, "gold_conflict_report.json"), "utf8")) as {
    all_results: Result[];
  };
  const feature = (r: Result, n: number) => join(DIR, r.repo, `task${r.task_id}`, `feature${n}`);
  const usable = report.all_results.filter((r) => !r.error);
  await embedAll(
    usable.flatMap((r) =>
      [r.f1, r.f2].map((n) => `PLAN ${summary(read(join(feature(r, n), "feature.md")) ?? "")}`),
    ),
    geminiKey(),
  );
  const rows: LabelledPair[] = [];
  for (const r of usable) {
    const [pa, pb] = [
      read(join(feature(r, r.f1), "feature.patch")),
      read(join(feature(r, r.f2), "feature.patch")),
    ];
    const [ma, mb] = [read(join(feature(r, r.f1), "feature.md")), read(join(feature(r, r.f2), "feature.md"))];
    if (!pa || !pb || !ma || !mb) continue;
    const id = `${r.repo}/${r.task_id}/${r.f1}+${r.f2}`;
    const group = `cooperbench:${r.repo}`;
    const meta = { source: "cooperbench", repo: group };
    const action = prPair(
      `cb:${id}:diff`,
      group,
      { id: `${id}:b`, agentId: "b", files: parseUnifiedDiff(pb), at: 3_600_000, text: `EDIT ${title(mb)}` },
      { id: `${id}:a`, agentId: "a", files: parseUnifiedDiff(pa), at: 0, text: `EDIT ${title(ma)}` },
      { relation: r.has_conflict ? "textual_conflict" : "overlap_compatible", origin: "dataset" },
      { ...meta, level: "action" },
    );
    if (action) rows.push(action);
    const intent = intentPair(
      `cb:${id}:intent`,
      group,
      planNode(`${id}:pb`, "b", summary(mb), 60_000),
      planNode(`${id}:pa`, "a", summary(ma), 0),
      { relation: "overlap_compatible", origin: "dataset" },
      { ...meta, level: "intent" },
    );
    if (intent) rows.push(intent);
  }
  const out = join(PAIRS_DIR, "cooperbench.jsonl");
  writeJsonl(out, rows);
  console.log(
    `cooperbench: ${usable.length} gold pairs → ${rows.length} rows ${JSON.stringify(tally(rows))} → ${out}`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
