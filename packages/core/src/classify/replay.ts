import type { LabelledPair } from "./pair-dataset";
import { BLOCKING_RELATIONS, inDomain, type Prediction, predict, settles } from "./pair-model";
import type { PairModel } from "./pair-model-schema";
import { type Relation, TYPE_OF } from "./types";

// Offline replay: the same labelled pairs through four architectures, using stored verdicts for the judge.

export const ARCHITECTURES = ["rules_only", "pair_model_only", "cascade", "llm_every_pair"] as const;
export type Architecture = (typeof ARCHITECTURES)[number];

export type LatencyModel = { rulesMs: number; modelMs: number; judgeMs: number };
/** Rules and the model are measured; the judge default is the live eval's median (~7 s per call). */
export const DEFAULT_LATENCY: LatencyModel = { rulesMs: 0.05, modelMs: 0.05, judgeMs: 7000 };

export type ArchitectureScore = {
  architecture: Architecture;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  /** F1 on "any finding" (duplicate, conflict or stale) rather than only blocking relations. */
  findingF1: number | null;
  accuracy: number;
  judgeCallsPerPair: number;
  latencyMsPerPair: number;
  /** Pairs where no stored judge verdict existed and the rule verdict (or "independent") stood in. */
  imputed: number;
};

/**
 * What the judge "says" on a pair with no stored verdict (public datasets never ran it): `independent` is a
 * lower bound for judge-based architectures, `oracle` (the true label) an upper bound.
 */
export type MissingJudge = "independent" | "oracle";

export type ReplayReport = {
  labels: "gold" | "teacher";
  pairs: number;
  missingJudge: MissingJudge;
  scores: ArchitectureScore[];
};

type Decision = { relation: Relation; judgeCalls: number; modelRan: boolean; imputed: boolean };

type Predictor = (row: LabelledPair) => Prediction;

function decideRow(arch: Architecture, row: LabelledPair, model: PairModel, oracle: Relation | null, predictOf: Predictor): Decision {
  const ruled = row.rule?.relation;
  const judged = row.judge?.relation;
  const base = { judgeCalls: 0, modelRan: false, imputed: false };
  if (arch === "rules_only") return { ...base, relation: ruled ?? "independent" };
  if (arch === "pair_model_only") return { ...base, modelRan: true, relation: predictOf(row).relation };
  if (arch === "llm_every_pair")
    return { ...base, judgeCalls: 1, imputed: !judged, relation: judged ?? oracle ?? ruled ?? "independent" };
  if (ruled) return { ...base, relation: ruled };
  const p = predictOf(row);
  if (inDomain(model, row.features) && settles(model, p)) return { ...base, modelRan: true, relation: p.relation };
  return { judgeCalls: 1, modelRan: true, imputed: !judged, relation: judged ?? oracle ?? "independent" };
}

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);
const f1 = (p: number | null, r: number | null): number | null =>
  p === null || r === null || p + r === 0 ? null : (2 * p * r) / (p + r);

function binary(pairs: [Relation, Relation][], positive: (r: Relation) => boolean) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const [pred, truth] of pairs) {
    if (positive(pred) && positive(truth)) tp += 1;
    else if (positive(pred)) fp += 1;
    else if (positive(truth)) fn += 1;
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return { precision, recall, f1: f1(precision, recall) };
}

export function truthOf(row: LabelledPair, labels: "gold" | "teacher"): Relation | null {
  if (labels === "gold") return row.gold?.relation ?? null;
  return row.gold?.relation ?? row.teacher?.relation ?? null;
}

/** Scores every architecture on gold-labelled rows, or on teacher labels when there is no gold at all. */
export function replay(
  rows: LabelledPair[],
  model: PairModel,
  latency: LatencyModel = DEFAULT_LATENCY,
  missingJudge: MissingJudge = "independent",
  /** Out-of-fold predictions from the trainer, so a row is never scored by a model that saw it. */
  predictions?: ReadonlyMap<string, Prediction>,
): ReplayReport {
  const predictOf: Predictor = (row) => predictions?.get(row.id) ?? predict(model, row.features);
  const labels = rows.some((r) => r.gold) ? "gold" : "teacher";
  const scored = rows.flatMap((r) => {
    const t = truthOf(r, labels);
    return t ? [{ row: r, truth: t }] : [];
  });
  const scores = ARCHITECTURES.map((architecture): ArchitectureScore => {
    const ds = scored.map(({ row, truth }) => ({
      d: decideRow(architecture, row, model, missingJudge === "oracle" ? truth : null, predictOf),
      truth,
      row,
    }));
    const pairs = ds.map(({ d, truth }): [Relation, Relation] => [d.relation, truth]);
    const blocking = binary(pairs, (r) => BLOCKING_RELATIONS.has(r));
    const n = Math.max(1, ds.length);
    const latencyTotal = ds.reduce(
      (sum, { d, row }) =>
        sum +
        latency.rulesMs +
        (d.modelRan ? latency.modelMs : 0) +
        d.judgeCalls * (row.judge?.latencyMs ?? latency.judgeMs),
      0,
    );
    return {
      architecture,
      ...blocking,
      findingF1: binary(pairs, (r) => TYPE_OF[r] !== "normal").f1,
      accuracy: pairs.filter(([p, t]) => p === t).length / n,
      judgeCallsPerPair: ds.reduce((s, { d }) => s + d.judgeCalls, 0) / n,
      latencyMsPerPair: latencyTotal / n,
      imputed: ds.filter(({ d }) => d.imputed).length,
    };
  });
  return { labels, pairs: scored.length, missingJudge, scores };
}

const pct = (x: number | null) => (x === null ? "–" : x.toFixed(2));
const ms = (x: number) => (x < 1 ? `${x.toFixed(2)} ms` : x < 1000 ? `${x.toFixed(0)} ms` : `${(x / 1000).toFixed(1)} s`);

export function replayMarkdown(r: ReplayReport, title: string): string {
  const head = [
    `### ${title}`,
    "",
    `${r.pairs} pairs scored against ${r.labels} labels. Blocking = textual, semantic, intent or ordering conflict.`,
    "",
    "| Architecture | Blocking precision | Blocking recall | Blocking F1 | Finding F1 | Relation accuracy | Judge calls / pair | Latency / pair |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const body = r.scores.map(
    (s) =>
      `| ${s.architecture.replace(/_/g, " ")} | ${pct(s.precision)} | ${pct(s.recall)} | ${pct(s.f1)} | ${pct(s.findingF1)} | ${pct(s.accuracy)} | ${s.judgeCallsPerPair.toFixed(2)} | ${ms(s.latencyMsPerPair)} |`,
  );
  const imputed = r.scores.filter((s) => s.imputed > 0);
  const notes = imputed.length
    ? [
        "",
        ...imputed.map(
          (s) => `- ${s.architecture}: ${s.imputed} pairs had no stored judge verdict (imputed as ${r.missingJudge}).`,
        ),
      ]
    : [];
  return [...head, ...body, ...notes].join("\n");
}
