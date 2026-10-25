import { isInterfaceChange } from "./catch";
import { applyCollisionPolicy } from "./collision";
import { isCrossCutting } from "./judge-gate";
import {
  ACTION_RANK,
  type Action,
  type CandidatePair,
  type Hint,
  type Judgment,
  type Relation,
} from "./types";

export type Verdict = Omit<Judgment, "action" | "retrievalScore" | "latencyMs">;

type Policy = { above: Action; threshold: number; below: Action };

/** Step 6 policy table. Thresholds are defaults; `calibrate` may override them per relation. */
export const POLICY: Record<Relation, Policy> = {
  independent: { above: "ignore", threshold: 0, below: "ignore" },
  overlap_compatible: { above: "ignore", threshold: 0, below: "ignore" },
  duplicate: { above: "warn", threshold: 0.7, below: "ignore" },
  textual_conflict: { above: "serialize", threshold: 0.8, below: "warn" },
  semantic_conflict: { above: "block", threshold: 0.85, below: "warn" },
  intent_contradiction: { above: "block", threshold: 0.8, below: "warn" },
  ordering_dependency: { above: "serialize", threshold: 0.7, below: "warn" },
  repeats_failure: { above: "warn", threshold: 0.75, below: "ignore" },
};

export type Thresholds = Partial<Record<Relation, number>>;

export type DecideContext = {
  nextKind: "intent" | "action" | "knowledge";
  /** R10 fired on an action: re-running a known-failing edit or command is the one stale case that is denied. */
  exactRepeat?: boolean;
  thresholds?: Thresholds;
};

export function capAction(action: Action, cap: Action): Action {
  return ACTION_RANK[action] > ACTION_RANK[cap] ? cap : action;
}

function policyAction(v: Verdict, ctx: DecideContext): Action {
  const p = POLICY[v.relation];
  const threshold = ctx.thresholds?.[v.relation] ?? p.threshold;
  if (v.confidence < threshold) return p.below;
  if (v.relation === "ordering_dependency" && v.direction === "other_needs_new") return "warn";
  if (v.relation === "repeats_failure" && ctx.exactRepeat) return "serialize";
  return p.above;
}

/**
 * Turn a verdict into a judgment for the new node's side. Plans never block. When the pair's nodes are
 * given, collisions are settled by claim strength (see collision.ts) rather than by who arrived first.
 */
export function decide(
  v: Verdict,
  pair: Pick<CandidatePair, "retrievalScore"> &
    Partial<Pick<CandidatePair, "next" | "other" | "failedMemory" | "reasons">>,
  ctx: DecideContext,
  latencyMs = 0,
): Judgment {
  let action = policyAction(v, ctx);
  // A model verdict may only stop an agent when one change can actually break the other (shared code, a
  // reference, a consumed topic). Topic- or similarity-only pairs are surfaced as warnings instead.
  if (v.source === "llm" && pair.reasons && !isCrossCutting({ reasons: pair.reasons })) {
    action = capAction(action, "warn");
  }
  const j: Judgment = {
    ...v,
    action: ctx.nextKind === "intent" ? capAction(action, "serialize") : action,
    retrievalScore: pair.retrievalScore,
    latencyMs,
  };
  return applyCollisionPolicy(j, pair);
}

/**
 * What the *other* agent is told. Failure memory is not news to its author; for ordering the
 * dependent side is the one that waits; everything else notifies both sides at the same level.
 */
export function otherSideAction(j: Judgment, other: { kind: string; failedMemory: boolean }): Action {
  if (j.relation === "repeats_failure" || other.failedMemory) return "ignore";
  // The changer of an interface hears about a caller found later as a hold at Stop: it alone can keep the old
  // interface working for the merge (see interventionAction).
  if (isInterfaceChange(j) && j.direction === "new_needs_other") return "block";
  if (isInterfaceChange(j)) return "warn";
  let action = j.action;
  if (j.relation === "ordering_dependency") action = j.direction === "other_needs_new" ? "serialize" : "warn";
  // The redirected side adapts on its own; the owner doesn't need to hear that someone was stopped.
  if (j.relation === "textual_conflict") action = "ignore";
  if (j.action === "ignore") action = "ignore";
  return other.kind === "intent" ? capAction(action, "serialize") : action;
}

/** Used when no rule settles a pair and the judge is unavailable, failed, or out of budget. */
export function fallbackJudgment(pair: CandidatePair, hints: Hint[]): Judgment {
  const relation: Relation = hints.length > 0 ? "overlap_compatible" : "independent";
  return {
    otherNodeId: pair.other.id,
    relation,
    direction: "none",
    confidence: hints.length > 0 ? 0.3 : 0.5,
    evidence: [...hints.map((h) => `${h.rule}: ${h.text}`), ...pair.reasons.map((r) => `retrieved: ${r}`)],
    action: "ignore",
    source: "fallback",
    retrievalScore: pair.retrievalScore,
    latencyMs: 0,
  };
}

export function worstAction(judgments: Pick<Judgment, "action">[]): Action {
  let worst: Action = "ignore";
  for (const j of judgments) if (ACTION_RANK[j.action] > ACTION_RANK[worst]) worst = j.action;
  return worst;
}

/** Most severe first, then most confident: the order evidence is shown in. */
export function bySeverity(a: Judgment, b: Judgment): number {
  return ACTION_RANK[b.action] - ACTION_RANK[a.action] || b.confidence - a.confidence;
}

export type PriorJudgment = { id: string; relation: string; action: Action; status: string };
export type DedupeDecision =
  | { kind: "insert" }
  | { kind: "raise"; id: string }
  | { kind: "skip"; id: string };

/** An open judgment for the same pair and relation re-alerts only when severity rises. */
export function dedupe(prior: PriorJudgment[], next: Pick<Judgment, "relation" | "action">): DedupeDecision {
  const same = prior.find((p) => p.relation === next.relation && p.status === "open");
  if (!same) return { kind: "insert" };
  return ACTION_RANK[next.action] > ACTION_RANK[same.action]
    ? { kind: "raise", id: same.id }
    : { kind: "skip", id: same.id };
}
