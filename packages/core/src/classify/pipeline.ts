import { type Candidate, scoreCandidates, TOP_K } from "./candidates";
import { bySeverity, type DecideContext, decide, POLICY, type Thresholds, type Verdict } from "./decide";
import { RULES } from "./rules/index";
import { ACTION_RANK, type CandidatePair, type Hint, type Judgment, type Rule } from "./types";

export type RuleOutcome = { verdict: Verdict | null; ruleId?: string; hints: Hint[] };

/** Step 3: run every rule; when several settle, the most severe wins and carries all their evidence. */
export function applyRules(pair: CandidatePair, rules: Rule[] = RULES): RuleOutcome {
  const hints: Hint[] = [];
  const settled: { verdict: Verdict; ruleId: string }[] = [];
  for (const rule of rules) {
    const r = rule.check(pair);
    if (!r) continue;
    if ("hint" in r) hints.push(r.hint);
    else settled.push({ verdict: r.judgment, ruleId: rule.id });
  }
  if (settled.length === 0) return { verdict: null, hints };
  settled.sort(
    (a, b) =>
      ACTION_RANK[POLICY[b.verdict.relation].above] - ACTION_RANK[POLICY[a.verdict.relation].above] ||
      b.verdict.confidence - a.verdict.confidence,
  );
  const [top, ...rest] = settled;
  if (!top) return { verdict: null, hints };
  const evidence = [...top.verdict.evidence];
  for (const s of rest) for (const e of s.verdict.evidence) if (!evidence.includes(e)) evidence.push(e);
  return { verdict: { ...top.verdict, evidence }, ruleId: top.ruleId, hints };
}

export function decideContext(
  pair: CandidatePair,
  ruleId: string | undefined,
  thresholds?: Thresholds,
): DecideContext {
  return {
    nextKind: pair.next.kind,
    exactRepeat: ruleId === "R10" && pair.next.kind === "action",
    thresholds,
  };
}

export type StructuralResult = {
  pairs: CandidatePair[];
  /** Pairs a rule settled, decided per the policy table, most severe first. */
  judgments: Judgment[];
  /** Pairs no rule settled: candidates for the judge, or a fallback judgment. */
  unsettled: { pair: CandidatePair; hints: Hint[] }[];
};

/** Steps 2, 3 and 6 for one new node. Pure and fast enough for the PreToolUse path. */
export function classifyStructural(
  next: Parameters<typeof scoreCandidates>[0],
  candidates: Candidate[],
  opts: { thresholds?: Thresholds; rules?: Rule[]; k?: number; now?: () => number } = {},
): StructuralResult {
  const now = opts.now ?? Date.now;
  const pairs = scoreCandidates(next, candidates, opts.k ?? TOP_K);
  const judgments: Judgment[] = [];
  const unsettled: StructuralResult["unsettled"] = [];
  for (const pair of pairs) {
    const started = now();
    const { verdict, ruleId, hints } = applyRules(pair, opts.rules);
    if (verdict) {
      const ctx = decideContext(pair, ruleId, opts.thresholds);
      judgments.push(decide(verdict, pair, ctx, now() - started));
    } else unsettled.push({ pair, hints });
  }
  judgments.sort(bySeverity);
  return { pairs, judgments, unsettled };
}
