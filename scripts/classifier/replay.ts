import { readFileSync, writeFileSync } from "node:fs";
import {
  DEFAULT_LATENCY,
  type LabelledPair,
  LabelledPairSchema,
  type Prediction,
  parsePairModel,
  predict,
  RELATIONS,
  type Relation,
  replay,
  replayMarkdown,
} from "../../packages/core/src/index";
import { flag } from "./datasets/common";

// Offline replay: rules only vs pair model only vs the cascade vs LLM on every pair, on the same labelled
// pairs. Prints a markdown table (for the website) and writes a JSON blob next to it.
//
//   npx tsx scripts/classifier/replay.ts --data a.jsonl,b.jsonl --model out/model.json \
//     [--oof out/oof.jsonl] [--out out/replay] [--title "…"]
// With --oof (recommended) each row is scored by the trainer's out-of-fold prediction, i.e. by a model that
// never saw its repository; without it the shipped model scores rows it was trained on.

function load(paths: string[]): LabelledPair[] {
  return paths.flatMap((p) =>
    readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => LabelledPairSchema.parse(JSON.parse(l))),
  );
}

/** train.py's oof.jsonl: calibrated probabilities from a model that never saw the row's repository. */
function oofPredictions(path: string): Map<string, Prediction> {
  const out = new Map<string, Prediction>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const { id, probs } = JSON.parse(line) as { id: string; probs: Partial<Record<Relation, number>> };
    const full = Object.fromEntries(RELATIONS.map((r) => [r, probs[r] ?? 0])) as Record<Relation, number>;
    const [first, second] = [...RELATIONS].sort((a, b) => full[b] - full[a]);
    if (!first || !second) continue;
    out.set(id, {
      relation: first,
      probs: full,
      confidence: full[first],
      margin: full[first] - full[second],
    });
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const model = parsePairModel(JSON.parse(readFileSync(flag(argv, "model", ""), "utf8")));
  if (!model.ok) throw new Error(model.error);
  let rows = load(flag(argv, "data", "").split(",").filter(Boolean));
  // Measure the model where it runs: features are precomputed, so this is inference alone.
  for (const r of rows) predict(model.model, r.features); // warm the JIT before timing
  const t0 = performance.now();
  for (const r of rows) predict(model.model, r.features);
  const modelMs = rows.length ? (performance.now() - t0) / rows.length : DEFAULT_LATENCY.modelMs;
  const latency = { ...DEFAULT_LATENCY, modelMs };
  const allJudged = rows.every((r) => r.judge);
  const synthetic = model.model.synthetic || rows.some((r) => r.synthetic);
  const title = flag(argv, "title", synthetic ? "SYNTHETIC replay (not real metrics)" : "Replay");
  const oof = flag(argv, "oof", "");
  const predictions = oof ? oofPredictions(oof) : undefined;
  if (predictions) rows = rows.filter((r) => predictions.has(r.id));
  const lower = replay(rows, model.model, latency, "independent", predictions);
  const upper = replay(rows, model.model, latency, "oracle", predictions);
  const md = allJudged
    ? replayMarkdown(lower, title)
    : [
        replayMarkdown(lower, `${title}: judge lower bound (no stored verdicts; missing = independent)`),
        "",
        replayMarkdown(upper, `${title}: judge upper bound (missing = perfect judge)`),
      ].join("\n");
  console.log(md);
  const out = flag(argv, "out", "");
  if (out) {
    writeFileSync(`${out}.md`, `${md}\n`);
    writeFileSync(
      `${out}.json`,
      JSON.stringify({ title, synthetic, model: model.model.version, latency, lower, upper }, null, 2),
    );
  }
}

main();
