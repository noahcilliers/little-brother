import { describeInterfaceChange, importerHits } from "../importers";
import type { ClassifiedNode, Direction, Rule } from "../types";
import { hint, settle } from "./settle";

/**
 * R12: one side changes the interface of a symbol that a file the other side edits imports (repo graph,
 * one hop). The edit need not name the symbol itself, which is what R5 misses. Settles below the block
 * threshold, so it warns: the importer may not touch the call site. A module-only import is a hint.
 */
export const r12ImporterInterface: Rule = {
  id: "R12",
  check(pair) {
    if (pair.failedMemory) return null;
    const cases: [ClassifiedNode, ClassifiedNode, Direction][] = [
      [pair.next, pair.other, "other_needs_new"],
      [pair.other, pair.next, "new_needs_other"],
    ];
    let loose: string | null = null;
    for (const [changer, user, direction] of cases) {
      const hits = importerHits(changer, user);
      const strong = hits.find((h) => h.via === "symbol");
      if (strong) {
        return settle(pair, "R12", "semantic_conflict", direction, 0.8, [
          `${describeInterfaceChange(strong)} on one side; ${strong.file} imports it and is edited on the other`,
        ]);
      }
      const weak = hits[0];
      if (weak && !loose)
        loose = `${describeInterfaceChange(weak)} on one side; ${weak.file} imports its module and is edited on the other`;
    }
    return loose ? hint("R12", loose) : null;
  },
};
