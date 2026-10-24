import type { Op } from "../ingest";
import type { ClassifiedNode } from "./types";

type Touch = ClassifiedNode["touches"][number];

export const MUTATING_OPS: ReadonlySet<Op> = new Set([
  "write",
  "create",
  "delete",
  "rename",
  "signature_change",
]);

export function isMutation(t: Touch): boolean {
  return MUTATING_OPS.has(t.op);
}

/** Symbols arrive as "path::name" from the TS normalizer, or as bare names from other languages. */
export function symbolName(symbol: string): string {
  const i = symbol.lastIndexOf("::");
  return i >= 0 ? symbol.slice(i + 2) : symbol;
}

export function symbolPath(symbol: string): string | undefined {
  const i = symbol.lastIndexOf("::");
  return i >= 0 ? symbol.slice(0, i) : undefined;
}

/**
 * True when two symbol strings name the same thing. Paths are compared only when both sides carry one,
 * and a member access ("User.role") matches its owner ("User") because changing the owner affects it.
 */
export function symbolsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = symbolPath(a);
  const pb = symbolPath(b);
  if (pa !== undefined && pb !== undefined && pa !== pb) return false;
  const na = symbolName(a);
  const nb = symbolName(b);
  return na === nb || na.startsWith(`${nb}.`) || nb.startsWith(`${na}.`);
}

/** A touch "covers" a reference when the reference names its symbol, or its file when the touch is file-level. */
export function touchCoversRef(t: Touch, ref: string): boolean {
  if (t.symbol) return symbolsMatch(t.symbol, ref);
  return ref === t.path || symbolPath(ref) === t.path;
}

export function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** Pairs of mutating touches on the same non-generated path. */
export function sharedMutatedPaths(a: ClassifiedNode, b: ClassifiedNode): [Touch, Touch][] {
  const out: [Touch, Touch][] = [];
  for (const ta of a.touches) {
    if (!isMutation(ta) || ta.generated) continue;
    for (const tb of b.touches) {
      if (isMutation(tb) && !tb.generated && tb.path === ta.path) out.push([ta, tb]);
    }
  }
  return out;
}

export function sharedSymbols(a: ClassifiedNode, b: ClassifiedNode): [Touch, Touch][] {
  const out: [Touch, Touch][] = [];
  for (const ta of a.touches) {
    if (!ta.symbol) continue;
    for (const tb of b.touches) {
      if (tb.symbol && symbolsMatch(ta.symbol, tb.symbol)) out.push([ta, tb]);
    }
  }
  return out;
}

/** Mutating touches of `mutator` that `user` references (by symbol or by file). */
export function mutationsReferencedBy(
  mutator: ClassifiedNode,
  user: ClassifiedNode,
  ops: ReadonlySet<Op>,
): { touch: Touch; ref: string }[] {
  const out: { touch: Touch; ref: string }[] = [];
  for (const t of mutator.touches) {
    if (!ops.has(t.op)) continue;
    for (const ref of user.references) {
      if (touchCoversRef(t, ref)) out.push({ touch: t, ref });
    }
  }
  return out;
}

export function describeTouch(t: Touch): string {
  return t.symbol ? symbolName(t.symbol) : t.path;
}

function touchKey(t: Touch): string {
  return `${t.path}|${t.symbol ?? ""}|${t.op}|${t.lines?.join("-") ?? ""}`;
}

/**
 * Same signature and the same touches: the identical hunk on both sides, which git merges cleanly.
 * Signatures hash the normalized edit, so this is the "compatible control" case, not a conflict.
 */
export function identicalChange(a: ClassifiedNode, b: ClassifiedNode): boolean {
  if (!a.signature || a.signature !== b.signature) return false;
  const ka = a.touches.map(touchKey).sort().join(",");
  return ka.length > 0 && ka === b.touches.map(touchKey).sort().join(",");
}
