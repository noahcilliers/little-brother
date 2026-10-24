import type { CandidatePair, Direction, Relation, RuleResult } from "../types";

export function settle(
  pair: CandidatePair,
  rule: string,
  relation: Relation,
  direction: Direction,
  confidence: number,
  evidence: string[],
): RuleResult {
  return {
    judgment: {
      otherNodeId: pair.other.id,
      relation,
      direction,
      confidence,
      evidence: [...evidence.map((e) => `${rule}: ${e}`), ...pair.reasons.map((r) => `retrieved: ${r}`)],
      source: "rule",
    },
  };
}

export function hint(rule: string, text: string): RuleResult {
  return { hint: { rule, text } };
}
