import type { Op } from "../ingest";
import { lexicalSimilarity } from "./lexical";
import {
  anyRefHit,
  createsSame,
  jaccard,
  type LineRelation,
  lineRelation,
  negates,
  opposed,
  paths,
  removedVsUsed,
  reportedSimilarity,
  sharedGenerated,
  targetTokens,
  tokenCosine,
} from "./pair-signals";
import { identicalChange, isMutation, MUTATING_OPS, sharedMutatedPaths, sharedSymbols } from "./touches";
import type { CandidatePair, ClassifiedNode, Hint } from "./types";

/**
 * Bump whenever a feature is added, removed, reordered or redefined: a model trained on another version
 * is refused at load, so the tier falls back to the judge instead of reading the wrong columns.
 */
export const FEATURE_VERSION = 2;

const VERBS = ["PLAN", "EDIT", "FIX", "TEST", "RUN", "EXPLORE", "LEARN", "REVERT", "DECIDE"] as const;
const SIGNATURE_OPS: ReadonlySet<Op> = new Set<Op>(["signature_change"]);
const CREATE_OPS: ReadonlySet<Op> = new Set<Op>(["create"]);

type Ctx = {
  next: ClassifiedNode;
  other: ClassifiedNode;
  pair: CandidatePair;
  hints: Set<string>;
  lines: LineRelation;
  sharedMutated: number;
  targetOverlap: number;
  similarity: number | null;
};

const b = (x: boolean): number => (x ? 1 : 0);
const reason = (c: Ctx, re: RegExp): number => b(c.pair.reasons.some((r) => re.test(r)));
const bothKind = (c: Ctx, k: ClassifiedNode["kind"]) => b(c.next.kind === k && c.other.kind === k);

const verbFeatures = (side: "next" | "other"): [string, (c: Ctx) => number][] =>
  VERBS.map((v) => [`${side}_verb_${v.toLowerCase()}`, (c) => b(c[side].verb === v)]);

const SPEC: [string, (c: Ctx) => number][] = [
  ["next_intent", (c) => b(c.next.kind === "intent")],
  ["next_action", (c) => b(c.next.kind === "action")],
  ["next_knowledge", (c) => b(c.next.kind === "knowledge")],
  ["other_intent", (c) => b(c.other.kind === "intent")],
  ["other_action", (c) => b(c.other.kind === "action")],
  ["other_knowledge", (c) => b(c.other.kind === "knowledge")],
  ["both_intent", (c) => bothKind(c, "intent")],
  ["both_action", (c) => bothKind(c, "action")],
  ...verbFeatures("next"),
  ...verbFeatures("other"),
  ["same_verb", (c) => b(c.next.verb === c.other.verb)],
  ["path_jaccard", (c) => jaccard(paths(c.next, false), paths(c.other, false))],
  ["mutated_path_jaccard", (c) => jaccard(paths(c.next, true), paths(c.other, true))],
  ["shared_mutated_paths", (c) => Math.min(c.sharedMutated, 3) / 3],
  [
    "same_symbol_mutation",
    (c) => b(sharedSymbols(c.next, c.other).some(([x, y]) => isMutation(x) || isMutation(y))),
  ],
  ["next_mutates_other_ref", (c) => b(anyRefHit(c.next, c.other, MUTATING_OPS))],
  ["other_mutates_next_ref", (c) => b(anyRefHit(c.other, c.next, MUTATING_OPS))],
  ["create_same_path", (c) => b(createsSame(c.next, c.other))],
  ["delete_rename_vs_use", (c) => b(removedVsUsed(c.next, c.other))],
  [
    "signature_change_vs_call",
    (c) => b(anyRefHit(c.next, c.other, SIGNATURE_OPS) || anyRefHit(c.other, c.next, SIGNATURE_OPS)),
  ],
  [
    "create_vs_reference",
    (c) => b(anyRefHit(c.next, c.other, CREATE_OPS) || anyRefHit(c.other, c.next, CREATE_OPS)),
  ],
  ["line_overlap", (c) => b(c.lines.overlap)],
  ["line_disjoint", (c) => b(c.lines.disjoint && !c.lines.overlap)],
  ["lines_unknown", (c) => b(c.lines.unknown)],
  ["generated_shared", (c) => b(sharedGenerated(c.next, c.other))],
  ["identical_change", (c) => b(identicalChange(c.next, c.other))],
  ["topic_match", (c) => b(!!c.next.topic && c.next.topic === c.other.topic)],
  ["topic_area_match", (c) => b(!!c.next.topic && c.next.topic.split(".")[0] === c.other.topic?.split(".")[0])],
  [
    "topic_consumed",
    (c) =>
      b(
        (!!c.next.topic && !!c.other.consumes?.includes(c.next.topic)) ||
          (!!c.other.topic && !!c.next.consumes?.includes(c.other.topic)),
      ),
  ],
  ["embedding_similarity", (c) => c.similarity ?? 0],
  ["has_embedding_similarity", (c) => b(c.similarity !== null)],
  ["text_overlap", (c) => lexicalSimilarity(c.next.text, c.other.text)],
  ["text_cosine", (c) => tokenCosine(c.next.text, c.other.text)],
  ["target_overlap", (c) => c.targetOverlap],
  ["preview_cosine", (c) => (c.next.preview && c.other.preview ? tokenCosine(c.next.preview, c.other.preview) : 0)],
  ["intent_text_cosine", (c) => (bothKind(c, "intent") ? tokenCosine(c.next.text, c.other.text) : 0)],
  ["opposed_actions", (c) => b(opposed(c.next, c.other))],
  ["negation_either", (c) => b(negates(c.next.text) || negates(c.other.text))],
  ["failed_memory", (c) => b(c.pair.failedMemory)],
  ["other_failed", (c) => b(c.other.outcome === "failed" || /\bFAIL\b/.test(c.other.text))],
  ["other_succeeded", (c) => b(c.other.outcome === "succeeded")],
  ["other_landed", (c) => b(c.other.landed !== undefined)],
  ["signature_match", (c) => b(!!c.next.signature && c.next.signature === c.other.signature)],
  ["retrieval_score", (c) => c.pair.retrievalScore],
  ["reason_count", (c) => Math.min(c.pair.reasons.length, 6) / 6],
  ["reason_both_mutate", (c) => reason(c, /both mutate/)],
  ["reason_both_touch", (c) => reason(c, /both touch/)],
  ["reason_references", (c) => reason(c, /references it/)],
  ["reason_consumes", (c) => reason(c, /consumes it/)],
  ["reason_imports", (c) => reason(c, / imports /)],
  ["reason_same_topic", (c) => reason(c, /same topic|failure on topic/)],
  ["reason_similar", (c) => reason(c, /^similar/)],
  ["reason_failure", (c) => reason(c, /recorded failure|known-failing/)],
  ["hint_r7", (c) => b(c.hints.has("R7"))],
  ["hint_r8", (c) => b(c.hints.has("R8"))],
  ["hint_r9", (c) => b(c.hints.has("R9"))],
  ["log_minutes_apart", (c) => Math.min(1, Math.log1p(Math.abs(c.next.at - c.other.at) / 60_000) / 8)],
];

export const FEATURE_NAMES: readonly string[] = SPEC.map(([name]) => name);

/**
 * The pair model's input: a fixed-length vector in FEATURE_NAMES order, built only from what the hot path
 * already has (both compact signatures, retrieval reasons, rule hints). Pure and well under a millisecond.
 */
export function pairFeatures(pair: CandidatePair, hints: Hint[]): number[] {
  const { next, other } = pair;
  const tn = targetTokens(next);
  const to = targetTokens(other);
  const ctx: Ctx = {
    next,
    other,
    pair,
    hints: new Set(hints.map((h) => h.rule)),
    lines: lineRelation(next, other),
    sharedMutated: sharedMutatedPaths(next, other).length,
    targetOverlap: jaccard(tn, to),
    similarity: reportedSimilarity(pair),
  };
  return SPEC.map(([, f]) => {
    const v = f(ctx);
    return Number.isFinite(v) ? v : 0;
  });
}

/** Named view of a feature vector, for evidence lines and debugging. */
export function featureMap(features: readonly number[]): Record<string, number> {
  return Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, features[i] ?? 0]));
}
