import type { Op } from "../ingest";
import { tokens } from "./lexical";
import { isMutation, mutationsReferencedBy, sharedMutatedPaths, sharedSymbols, symbolName } from "./touches";
import type { CandidatePair, ClassifiedNode } from "./types";

// Small set measures shared by the pair features. Kept separate so features.ts stays a flat list.

export function jaccard<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Cosine of binary content-word vectors: cheap, and fair to texts of different lengths. */
export function tokenCosine(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.sqrt(ta.size * tb.size);
}

export function paths(n: ClassifiedNode, mutatedOnly: boolean): Set<string> {
  return new Set(n.touches.filter((t) => !mutatedOnly || isMutation(t)).map((t) => t.path));
}

/** What a node points at, as words: path segments, symbol names and references. */
export function targetTokens(n: ClassifiedNode): Set<string> {
  const parts = [
    ...n.touches.flatMap((t) => [t.path, t.symbol ? symbolName(t.symbol) : ""]),
    ...n.references.map(symbolName),
  ];
  return tokens(parts.join(" ").replace(/([a-z])([A-Z])/g, "$1 $2"));
}

const NEGATION = /\b(don'?t|do not|no|not|never|without|avoid)\b/i;
const RULE_OUT = new Set([
  "no",
  "not",
  "never",
  "without",
  "avoid",
  "instead",
  "remove",
  "removes",
  "drop",
  "dont",
  "don",
  "deprecate",
  "replace",
  "disable",
  "stop",
]);
const SKIP = new Set(["use", "using", "the", "a", "an", "any", "of", "to", "t", "add", "touch", "with"]);

export const negates = (text: string): boolean => NEGATION.test(text);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/** Terms a text rules out: content words within three words after "no", "don't", "instead of", "remove"… */
export function ruledOut(text: string): Set<string> {
  const ws = words(text);
  const out = new Set<string>();
  ws.forEach((w, i) => {
    if (!RULE_OUT.has(w)) return;
    for (const x of ws.slice(i + 1, i + 4)) if (!SKIP.has(x) && !RULE_OUT.has(x) && x.length >= 3) out.add(x);
  });
  return out;
}

/** One side rules out what the other builds on ("no cookies" vs "session cookie"): the contradiction cue. */
export function opposed(a: ClassifiedNode, b: ClassifiedNode): boolean {
  const hit = (x: ClassifiedNode, y: ClassifiedNode) => {
    const out = ruledOut(x.text);
    const yOut = ruledOut(y.text);
    return words(y.text).some((w) => out.has(w) && !yOut.has(w));
  };
  return hit(a, b) || hit(b, a);
}

export function anyRefHit(mutator: ClassifiedNode, user: ClassifiedNode, ops: ReadonlySet<Op>): boolean {
  return mutationsReferencedBy(mutator, user, ops).length > 0;
}

export function createsSame(a: ClassifiedNode, b: ClassifiedNode): boolean {
  const create = ([x, y]: [{ op: Op }, { op: Op }]) => x.op === "create" && y.op === "create";
  return sharedMutatedPaths(a, b).some(create) || sharedSymbols(a, b).some(create);
}

const REMOVE_OPS: ReadonlySet<Op> = new Set<Op>(["delete", "rename"]);

/** R4's shape in either direction: removed on one side, used or edited on the other. */
export function removedVsUsed(a: ClassifiedNode, b: ClassifiedNode): boolean {
  const edited = (x: ClassifiedNode, y: ClassifiedNode) =>
    [...sharedMutatedPaths(x, y), ...sharedSymbols(x, y)].some(
      ([r, u]) => REMOVE_OPS.has(r.op) && u.op === "write",
    );
  return anyRefHit(a, b, REMOVE_OPS) || anyRefHit(b, a, REMOVE_OPS) || edited(a, b) || edited(b, a);
}

export type LineRelation = { overlap: boolean; disjoint: boolean; unknown: boolean };

export function lineRelation(a: ClassifiedNode, b: ClassifiedNode): LineRelation {
  const out: LineRelation = { overlap: false, disjoint: false, unknown: false };
  for (const [x, y] of sharedMutatedPaths(a, b)) {
    if (!x.lines || !y.lines) out.unknown = true;
    else if (x.lines[0] <= y.lines[1] && y.lines[0] <= x.lines[1]) out.overlap = true;
    else out.disjoint = true;
  }
  return out;
}

export function sharedGenerated(a: ClassifiedNode, b: ClassifiedNode): boolean {
  const other = new Set(b.touches.filter((t) => t.generated).map((t) => t.path));
  return a.touches.some((t) => t.generated && other.has(t.path));
}

/** The cosine the vector index reported, recovered from the retrieval reason ("similar intent (0.83)"). */
export function reportedSimilarity(pair: Pick<CandidatePair, "reasons">): number | null {
  let best: number | null = null;
  for (const r of pair.reasons) {
    const m = /^similar.*\(([\d.]+)\)/.exec(r);
    const v = m?.[1] ? Number(m[1]) : Number.NaN;
    if (Number.isFinite(v)) best = Math.max(best ?? 0, v);
  }
  return best;
}
