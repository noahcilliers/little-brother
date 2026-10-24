import { z } from "zod";
import { FEATURE_NAMES, FEATURE_VERSION, pairFeatures } from "./features";
import { applyRules } from "./pipeline";
import { type CandidatePair, type ClassifiedNode, RELATIONS, type Relation, TYPE_OF } from "./types";

// One training/eval row per classified pair: features plus every label we have for it. The JSONL the
// exporters write and scripts/classifier/train.py reads.

const Rel = z.enum(RELATIONS);
const Dir = z.enum(["new_needs_other", "other_needs_new", "none"]);

export const LabelledPairSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  /** Run or session: the train/validation split keeps a group on one side, so nothing leaks. */
  group: z.string(),
  featureVersion: z.number().int(),
  features: z.array(z.number()),
  /** What rules R1–R11 settle for this pair now (recomputed), or null when they leave it open. */
  rule: z.object({ relation: Rel, direction: Dir, ruleId: z.string() }).nullable(),
  /** The stored verdict. LLM and rule verdicts are teacher labels; fallback and pair_model ones are not. */
  teacher: z
    .object({
      relation: Rel,
      direction: Dir,
      confidence: z.number(),
      source: z.enum(["rule", "pair_model", "llm", "fallback"]),
    })
    .nullable(),
  /** The judge's own verdict when one was stored: what "LLM on every pair" would have said. */
  judge: z.object({ relation: Rel, confidence: z.number(), latencyMs: z.number() }).nullable(),
  /** Ground truth: human feedback, lb verify, an eval's evidence checks, a public dataset, or the generator. */
  gold: z
    .object({ relation: Rel, origin: z.enum(["feedback", "git", "eval", "dataset", "synthetic"]) })
    .nullable(),
  synthetic: z.boolean().default(false),
  meta: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type LabelledPair = z.infer<typeof LabelledPairSchema>;
export type Gold = NonNullable<LabelledPair["gold"]>;

export const TEACHER_WEIGHT = 0.3;

const idx = (name: string) => FEATURE_NAMES.indexOf(name);
const at = (f: readonly number[], name: string) => f[idx(name)] ?? 0;

/** A gold "nothing here": compatible overlap when the two share files, symbols or a topic, else independent. */
export function negativeRelation(features: readonly number[]): Relation {
  const overlap =
    at(features, "path_jaccard") > 0 ||
    at(features, "same_symbol_mutation") > 0 ||
    at(features, "topic_match") > 0;
  return overlap ? "overlap_compatible" : "independent";
}

export const isFindingRelation = (r: Relation): boolean => TYPE_OF[r] !== "normal";
const GIT_NEGATABLE: ReadonlySet<Relation> = new Set<Relation>([
  "independent",
  "overlap_compatible",
  "textual_conflict",
  "semantic_conflict",
  "ordering_dependency",
]);

/**
 * Gold label from outcomes (PLAN §4 step 7, §5). Human feedback beats git. A clean merge with green tests
 * refutes only what git can see (textual, semantic, ordering), not a duplicate or a repeated failure.
 */
export function goldFromOutcome(
  row: { relation: Relation; feedback?: string; gitStatus?: string },
  features: readonly number[],
): Gold | null {
  if (row.feedback === "confirmed") return { relation: row.relation, origin: "feedback" };
  if (row.feedback === "false_positive") return { relation: negativeRelation(features), origin: "feedback" };
  if (row.gitStatus === "confirmed" || row.gitStatus === "missed")
    return { relation: isFindingRelation(row.relation) ? row.relation : "textual_conflict", origin: "git" };
  if (row.gitStatus === "clean" && GIT_NEGATABLE.has(row.relation))
    return { relation: negativeRelation(features), origin: "git" };
  return null;
}

/** The label a row trains on: gold at full weight, a rule or judge verdict at TEACHER_WEIGHT. */
export function trainingTarget(row: LabelledPair): { relation: Relation; weight: number } | null {
  if (row.gold) return { relation: row.gold.relation, weight: 1 };
  if (row.teacher && (row.teacher.source === "rule" || row.teacher.source === "llm"))
    return { relation: row.teacher.relation, weight: TEACHER_WEIGHT };
  return null;
}

/** Retrieval reasons travel in stored evidence as "retrieved: …" lines (see rules/settle.ts and the judge). */
export function reasonsFromEvidence(evidence: string[]): string[] {
  return evidence.filter((e) => e.startsWith("retrieved: ")).map((e) => e.slice("retrieved: ".length));
}

export type LabelInput = {
  id: string;
  group: string;
  pair: CandidatePair;
  teacher?: LabelledPair["teacher"];
  judge?: LabelledPair["judge"];
  gold?: Gold | null;
  /** Computes gold from the features when the label depends on them (negatives). */
  goldFrom?: (features: number[]) => Gold | null;
  synthetic?: boolean;
  meta?: Record<string, string | number | boolean>;
};

/** Features and rule verdict recomputed from the pair, plus the labels we were given. */
export function labelPair(input: LabelInput): LabelledPair {
  const { verdict, ruleId, hints } = applyRules(input.pair);
  const features = pairFeatures(input.pair, hints);
  return {
    v: 1,
    id: input.id,
    group: input.group,
    featureVersion: FEATURE_VERSION,
    features,
    rule: verdict && ruleId ? { relation: verdict.relation, direction: verdict.direction, ruleId } : null,
    teacher: input.teacher ?? null,
    judge: input.judge ?? null,
    gold: input.gold ?? input.goldFrom?.(features) ?? null,
    synthetic: input.synthetic ?? false,
    ...(input.meta ? { meta: input.meta } : {}),
  };
}

export function pairMeta(next: ClassifiedNode, other: ClassifiedNode): Record<string, string> {
  return { nextText: next.text, otherText: other.text, nextKind: next.kind, otherKind: other.kind };
}
