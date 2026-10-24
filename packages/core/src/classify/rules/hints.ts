import { isMutation, rangesOverlap, sharedMutatedPaths, sharedSymbols, symbolName } from "../touches";
import type { Rule } from "../types";
import { hint } from "./settle";

/** R7: both mutate the same symbol but lines are unknown, so the judge has to look. */
export const r7SameSymbol: Rule = {
  id: "R7",
  check(pair) {
    if (pair.failedMemory) return null;
    for (const [a, b] of sharedSymbols(pair.next, pair.other)) {
      if (isMutation(a) && isMutation(b) && a.symbol && (!a.lines || !b.lines)) {
        return hint("R7", `both mutate ${symbolName(a.symbol)}; line ranges unknown`);
      }
    }
    return null;
  },
};

/** R8: same file, disjoint ranges — likely compatible. */
export const r8DisjointRanges: Rule = {
  id: "R8",
  check(pair) {
    if (pair.failedMemory) return null;
    for (const [a, b] of sharedMutatedPaths(pair.next, pair.other)) {
      if (a.lines && b.lines && !rangesOverlap(a.lines, b.lines)) {
        return hint("R8", `same file ${a.path}, disjoint ranges: likely compatible`);
      }
    }
    return null;
  },
};

/** R9: the only shared path is generated or a lockfile — low signal. */
export const r9GeneratedOnly: Rule = {
  id: "R9",
  check(pair) {
    if (pair.failedMemory) return null;
    if (sharedMutatedPaths(pair.next, pair.other).length > 0) return null;
    const otherPaths = new Set(pair.other.touches.filter((t) => isMutation(t)).map((t) => t.path));
    const generated = pair.next.touches.find((t) => t.generated && isMutation(t) && otherPaths.has(t.path));
    return generated ? hint("R9", `only overlap is generated file ${generated.path}: low signal`) : null;
  },
};
