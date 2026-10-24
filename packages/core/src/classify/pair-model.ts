import { POLICY } from "./decide";
import type { PairModel } from "./pair-model-schema";
import { RELATIONS, type Relation } from "./types";

export type Prediction = {
  relation: Relation;
  /** Calibrated probability per relation; relations the model never saw get 0. */
  probs: Record<Relation, number>;
  confidence: number;
  /** Top probability minus the runner-up. */
  margin: number;
};

/** Relations whose verdict can stop an agent (serialize or block above threshold). */
export const BLOCKING_RELATIONS: ReadonlySet<Relation> = new Set(
  RELATIONS.filter((r) => POLICY[r].above === "serialize" || POLICY[r].above === "block"),
);
export const SEVERE_THRESHOLD = 0.9;
export const DEFAULT_THRESHOLD = 0.75;

function rawScores(model: PairModel, x: readonly number[]): number[] {
  const e = model.estimator;
  if (e.kind === "logreg") {
    return e.weights.map((w, k) => {
      let z = e.bias[k] ?? 0;
      for (let i = 0; i < w.length; i++)
        z += (w[i] ?? 0) * (((x[i] ?? 0) - (e.mean[i] ?? 0)) / (e.scale[i] ?? 1));
      return z;
    });
  }
  const z = [...e.base];
  for (const tree of e.trees) {
    let i = 0;
    for (;;) {
      const n = tree.nodes[i];
      if (!n) break;
      if ("v" in n) {
        z[tree.c] = (z[tree.c] ?? 0) + n.v;
        break;
      }
      // scikit-learn compares in float32; matching it keeps exported trees bit-for-bit faithful.
      i = Math.fround(x[n.f] ?? 0) <= n.t ? n.l : n.r;
    }
  }
  return z;
}

function softmax(z: number[]): number[] {
  const max = Math.max(...z);
  const ex = z.map((v) => Math.exp(v - max));
  const sum = ex.reduce((a, v) => a + v, 0);
  return ex.map((v) => v / sum);
}

/** Linear interpolation clipped to the ends, like numpy.interp (what isotonic regression predicts with). */
function interp(p: number, xs: number[], ys: number[]): number {
  const n = xs.length;
  if (p <= (xs[0] ?? 0)) return ys[0] ?? 0;
  if (p >= (xs[n - 1] ?? 1)) return ys[n - 1] ?? 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] ?? 0) <= p) lo = mid;
    else hi = mid;
  }
  const x0 = xs[lo] ?? 0;
  const x1 = xs[hi] ?? 1;
  const y0 = ys[lo] ?? 0;
  const y1 = ys[hi] ?? 1;
  return x1 === x0 ? y0 : y0 + ((p - x0) * (y1 - y0)) / (x1 - x0);
}

function calibrate(model: PairModel, p: number[]): number[] {
  if (!model.calibration) return p;
  const q = p.map((v, k) => {
    const c = model.calibration?.[k];
    if (!c) return v;
    return c.kind === "platt" ? 1 / (1 + Math.exp(c.a * v + c.b)) : interp(v, c.x, c.y);
  });
  const sum = q.reduce((a, v) => a + v, 0);
  return sum > 0 ? q.map((v) => v / sum) : p;
}

/** Pure inference over a validated model: well under a millisecond for the sizes the trainer exports. */
export function predict(model: PairModel, features: readonly number[]): Prediction {
  const p = calibrate(model, softmax(rawScores(model, features)));
  const probs = Object.fromEntries(RELATIONS.map((r) => [r, 0])) as Record<Relation, number>;
  model.classes.forEach((r, k) => {
    probs[r] = p[k] ?? 0;
  });
  const ranked = [...RELATIONS].sort((a, b) => probs[b] - probs[a]);
  const relation = ranked[0] ?? "independent";
  return {
    relation,
    probs,
    confidence: probs[relation],
    margin: probs[relation] - probs[ranked[1] ?? relation],
  };
}

export function settleThreshold(model: Pick<PairModel, "thresholds">, relation: Relation): number {
  return (
    model.thresholds?.[relation] ?? (BLOCKING_RELATIONS.has(relation) ? SEVERE_THRESHOLD : DEFAULT_THRESHOLD)
  );
}

/** The model settles a pair only when it is sure and the runner-up is not close; otherwise the judge decides. */
export function settles(model: Pick<PairModel, "thresholds" | "minMargin">, p: Prediction): boolean {
  return p.confidence >= settleThreshold(model, p.relation) && p.margin >= model.minMargin;
}

const KINDS = ["intent", "action", "knowledge"] as const;

/** "next>other" kinds and the failure-memory flag, read back from a feature vector. */
export function pairKind(
  names: readonly string[],
  x: readonly number[],
): { kinds: string; failedMemory: boolean } {
  const at = (n: string) => x[names.indexOf(n)] ?? 0;
  const kind = (side: string) => KINDS.find((k) => at(`${side}_${k}`) === 1) ?? "action";
  return { kinds: `${kind("next")}>${kind("other")}`, failedMemory: at("failed_memory") === 1 };
}

/** Whether a pair looks like what the model was trained on (always true for models without a domain). */
export function inDomain(model: Pick<PairModel, "domain" | "featureNames">, x: readonly number[]): boolean {
  if (!model.domain) return true;
  const k = pairKind(model.featureNames, x);
  return model.domain.kindPairs.includes(k.kinds) && (model.domain.failedMemory || !k.failedMemory);
}
