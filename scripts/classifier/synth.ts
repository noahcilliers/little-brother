import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type LabelledPair, labelPair, pairMeta, RELATIONS, type Relation, scoreCandidates } from "../../packages/core/src/index";
import { flag, rng } from "./datasets/common";
import { negativeShapes, plantedShapes, type Rand, type Shape } from "./synth-shapes";
import { plantedPairs, scenarioUnits } from "./synth-vocab";

// SYNTHETIC labelled pairs for CI and smoke runs ONLY. Built from the eval cases' planted clashes and controls
// and the demo story's agents; the "judge" is simulated. Every row is marked synthetic: never quote its
// metrics as real ones.
//
//   npx tsx scripts/classifier/synth.ts --replicates 40 --seed 7 --out scripts/classifier/fixtures/synthetic.jsonl

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** A judge that is right most of the time, less so on hard pairs, with ~7 s median latency. */
function simulatedJudge(r: Rand, truth: Relation, hard: boolean): NonNullable<LabelledPair["judge"]> {
  const right = r() < (hard ? 0.82 : 0.93);
  const wrong: Relation = truth === "independent" || truth === "overlap_compatible" ? (r() < 0.5 ? "duplicate" : "intent_contradiction") : "overlap_compatible";
  const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return { relation: right ? truth : wrong, confidence: Number((0.6 + r() * 0.35).toFixed(2)), latencyMs: Math.round(7000 * Math.exp(0.35 * z)) };
}

function row(r: Rand, s: Shape, id: string, group: string, goldShare: number): LabelledPair | null {
  const [pair] = scoreCandidates(s.next, [{ node: s.other, failedMemory: s.failedMemory, ...(s.similarity !== undefined ? { similarity: s.similarity } : {}) }]);
  if (!pair) return null;
  const judge = simulatedJudge(r, s.truth, s.hard);
  const labelled = labelPair({
    id,
    group,
    pair,
    judge,
    gold: r() < goldShare ? { relation: s.truth, origin: "synthetic" } : null,
    synthetic: true,
    meta: { ...pairMeta(s.next, s.other), hard: s.hard, truth: s.truth },
  });
  const teacher = labelled.rule
    ? { relation: labelled.rule.relation, direction: labelled.rule.direction, confidence: 0.9, source: "rule" as const }
    : { relation: judge.relation, direction: "none" as const, confidence: judge.confidence, source: "llm" as const };
  return { ...labelled, teacher };
}

export function synthesize(replicates: number, seed: number, goldShare: number): LabelledPair[] {
  const r = rng(seed);
  const planted = plantedPairs();
  const units = scenarioUnits(resolve(ROOT, "fixtures/scenario.jsonl"));
  const out: LabelledPair[] = [];
  for (let k = 0; k < replicates; k++) {
    const at = 1_700_000_000_000 + k * 86_400_000;
    for (const p of planted) {
      const group = `synthetic:${p.caseId}:${k}`;
      const shapes = p.control ? negativeShapes(r, p.a, p.b, at) : plantedShapes(r, p, at);
      shapes.forEach((s, i) => {
        const x = row(r, s, `${group}:${i}`, group, goldShare);
        if (x) out.push(x);
      });
    }
    // Demo-story agents on unrelated workstreams: the bulk of real traffic is pairs like these.
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      const b = units[(i + 1 + k) % units.length];
      if (!a || !b || a.handle === b.handle) continue;
      const group = `synthetic:scenario:${k}`;
      negativeShapes(r, a, b, at).forEach((s, j) => {
        const x = row(r, s, `${group}:${i}:${j}`, group, goldShare);
        if (x) out.push(x);
      });
    }
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const out = resolve(flag(argv, "out", "scripts/classifier/fixtures/synthetic.jsonl"));
  const rows = synthesize(Number(flag(argv, "replicates", "40")), Number(flag(argv, "seed", "7")), Number(flag(argv, "gold", "0.6")));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${rows.map((x) => JSON.stringify(x)).join("\n")}\n`);
  const counts = Object.fromEntries(RELATIONS.map((rel) => [rel, rows.filter((x) => x.meta?.truth === rel).length]));
  console.log(`SYNTHETIC: ${rows.length} pairs → ${out}\n${JSON.stringify(counts)}`);
}

main();
