import type { CandidatePair } from "./types";

const CROSS_CUTTING = /consumes it|references it|both touch|both mutate/;

/** A structural link (same file, symbol, topic, consumer, reference) rather than only similar wording. */
export function hasStructuralLink(pair: Pick<CandidatePair, "reasons">): boolean {
  return pair.reasons.some((r) => !r.startsWith("similar"));
}

/** Links where one change can actually break the other: shared code, a reference, or a consumed topic. */
export function isCrossCutting(pair: Pick<CandidatePair, "reasons">): boolean {
  return pair.reasons.some((r) => CROSS_CUTTING.test(r));
}

/**
 * Only pairs worth a model call: a structural link, or wording similar enough that a duplicate is likely.
 * Weak similarity alone produced most false alarms (and most of the cost) in the demo run.
 */
export function judgeWorthy(pair: Pick<CandidatePair, "reasons">, minSimilarity = 0.8): boolean {
  if (hasStructuralLink(pair)) return true;
  const sims = pair.reasons.map((r) => Number(/\(([\d.]+)\)/.exec(r)?.[1] ?? 0));
  return Math.max(0, ...sims) >= minSimilarity;
}

/**
 * The similarity a pair needs before it is worth a judge call when nothing structural links it. Failure memory
 * is cheap to confirm; two plans are judged once per prompt and contradict each other on business rules
 * ("sale prices are final" vs "the promo applies to every item") at only moderate wording similarity.
 */
export function judgeThreshold(pair: Pick<CandidatePair, "failedMemory" | "next" | "other">): number {
  if (pair.failedMemory) return 0.5;
  if (pair.next.kind === "intent" && pair.other.kind === "intent") return 0.55;
  return 0.8;
}
