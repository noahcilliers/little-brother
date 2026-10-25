import {
  type ClassifiedNode,
  type Gold,
  type LabelledPair,
  labelPair,
  lexicalSimilarity,
  pairMeta,
  scoreCandidates,
} from "../../../packages/core/src/index";
import { filesIn } from "../synth-vocab";
import { cosine } from "./embed";

// Plan-vs-plan pairs as production sees them: two PLAN nodes (text plus any paths the plan names), retrieved
// by intent similarity (Gemini cosine when cached, else the lexical score the backend falls back to).

export function planNode(id: string, agentId: string, prompt: string, at: number): ClassifiedNode {
  const text = `PLAN ${prompt.replace(/\s+/g, " ").trim()}`.slice(0, 400);
  return {
    id,
    agentId,
    kind: "intent",
    verb: "PLAN",
    text,
    outcome: "open",
    touches: filesIn(prompt).map((path) => ({ path, op: "write" as const })),
    references: [],
    at,
  };
}

/** A failed attempt as the lesson the backend distills from it. */
export function lessonNode(
  id: string,
  agentId: string,
  what: string,
  files: string[],
  at: number,
): ClassifiedNode {
  return {
    id,
    agentId,
    kind: "knowledge",
    verb: "LEARN",
    text: `LEARN: tried ${what.replace(/\s+/g, " ").slice(0, 200)}${files.length ? ` (${files.slice(0, 3).join(", ")})` : ""} → FAIL`,
    outcome: "succeeded",
    touches: files.map((path) => ({ path, op: "write" as const })),
    references: [],
    at,
  };
}

export function similarityOf(a: string, b: string): number {
  return Number((cosine(a, b) ?? lexicalSimilarity(a, b)).toFixed(3));
}

export function intentPair(
  id: string,
  group: string,
  next: ClassifiedNode,
  other: ClassifiedNode,
  gold: Gold | ((f: number[]) => Gold | null) | null,
  meta: Record<string, string | number | boolean>,
  extra: Partial<Pick<LabelledPair, "teacher" | "judge">> = {},
): LabelledPair | null {
  const failedMemory = other.kind === "knowledge" || other.outcome === "failed";
  const similarity = similarityOf(next.text, other.text);
  const [pair] = scoreCandidates(next, [{ node: other, failedMemory, similarity }]);
  if (!pair) return null;
  return labelPair({
    id,
    group,
    pair,
    ...(typeof gold === "function" ? { goldFrom: gold } : { gold }),
    ...extra,
    meta: { ...pairMeta(next, other), similarity, ...meta },
  });
}
