import { capAction, type DecideContext, decide } from "./decide";
import { pairFeatures } from "./features";
import { isCrossCutting } from "./judge-gate";
import { ruleDirection } from "./pair-direction";
import { inDomain, type Prediction, predict, settles } from "./pair-model";
import type { PairModel } from "./pair-model-schema";
import type { CandidatePair, Hint, Judgment } from "./types";

export type Unsettled = { pair: CandidatePair; hints: Hint[] };

export type TierResult<T extends Unsettled> = {
  /** Pairs the model was sure about, decided per the policy table. */
  judgments: Judgment[];
  /** Pairs left for the judge, in their original order. */
  rest: T[];
  predictions: { otherNodeId: string; prediction: Prediction; settled: boolean }[];
};

/** One model verdict as a judgment. Like the judge, it may only stop an agent over a cross-cutting link. */
export function pairModelJudgment(
  model: PairModel,
  { pair, hints }: Unsettled,
  p: Prediction,
  ctx: DecideContext,
  latencyMs: number,
): Judgment {
  const j = decide(
    {
      otherNodeId: pair.other.id,
      relation: p.relation,
      direction: ruleDirection(pair, p.relation),
      confidence: Number(p.confidence.toFixed(4)),
      evidence: [
        `pair_model ${model.version}: ${p.relation} (${p.confidence.toFixed(2)}, margin ${p.margin.toFixed(2)})`,
        ...hints.map((h) => `${h.rule}: ${h.text}`),
        ...pair.reasons.map((r) => `retrieved: ${r}`),
      ],
      source: "pair_model",
    },
    pair,
    ctx,
    latencyMs,
  );
  return isCrossCutting(pair) ? j : { ...j, action: capAction(j.action, "warn") };
}

/**
 * Step 4: run the learned model on every pair no rule settled. Confident pairs settle here in well under a
 * millisecond; uncertain ones (low confidence or a close runner-up) go on to the judge unchanged.
 */
export function settleByPairModel<T extends Unsettled>(
  model: PairModel,
  unsettled: T[],
  ctx: DecideContext,
  now: () => number = () => performance.now(),
): TierResult<T> {
  const out: TierResult<T> = { judgments: [], rest: [], predictions: [] };
  for (const u of unsettled) {
    const started = now();
    const x = pairFeatures(u.pair, u.hints);
    const p = predict(model, x);
    const ok = inDomain(model, x) && settles(model, p);
    out.predictions.push({ otherNodeId: u.pair.other.id, prediction: p, settled: ok });
    if (ok) out.judgments.push(pairModelJudgment(model, u, p, ctx, Math.round(now() - started)));
    else out.rest.push(u);
  }
  return out;
}
