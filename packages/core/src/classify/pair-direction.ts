import type { Op } from "../ingest";
import { anyRefHit } from "./pair-signals";
import { MUTATING_OPS } from "./touches";
import type { CandidatePair, Direction, Relation } from "./types";

const BREAKING: ReadonlySet<Op> = new Set<Op>(["delete", "rename", "signature_change"]);

/**
 * Direction for a model verdict, derived the way rules R4–R6 and R10 derive it, so the pair model needs no
 * extra head: the side that uses what the other changes or creates is the one that needs the other.
 */
export function ruleDirection(pair: CandidatePair, relation: Relation): Direction {
  const { next, other } = pair;
  if (relation === "repeats_failure") return "new_needs_other";
  if (relation === "semantic_conflict") {
    if (anyRefHit(other, next, BREAKING)) return "new_needs_other";
    if (anyRefHit(next, other, BREAKING)) return "other_needs_new";
    return "none";
  }
  if (relation === "ordering_dependency") {
    if (anyRefHit(other, next, MUTATING_OPS)) return "new_needs_other";
    if (anyRefHit(next, other, MUTATING_OPS)) return "other_needs_new";
    // No reference to go on: the work already under way is what the newer one builds on.
    return other.at <= next.at ? "new_needs_other" : "other_needs_new";
  }
  return "none";
}
