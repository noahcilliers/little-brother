import type { Op } from "../../ingest";
import { describeTouch, mutationsReferencedBy } from "../touches";
import type { ClassifiedNode, Direction, Rule } from "../types";
import { settle } from "./settle";

const SIGNATURE: ReadonlySet<Op> = new Set<Op>(["signature_change"]);

/** R5: one side changes the signature of a symbol the other calls. */
export const r5SignatureChange: Rule = {
  id: "R5",
  check(pair) {
    if (pair.failedMemory) return null;
    const cases: [ClassifiedNode, ClassifiedNode, Direction][] = [
      [pair.next, pair.other, "other_needs_new"],
      [pair.other, pair.next, "new_needs_other"],
    ];
    for (const [changer, caller, direction] of cases) {
      const hit = mutationsReferencedBy(changer, caller, SIGNATURE)[0];
      if (hit) {
        return settle(pair, "R5", "semantic_conflict", direction, 0.85, [
          `signature of ${describeTouch(hit.touch)} changes on one side while the other calls it`,
        ]);
      }
    }
    return null;
  },
};
