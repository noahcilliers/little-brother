import type { Op } from "../../ingest";
import { describeTouch, mutationsReferencedBy } from "../touches";
import type { ClassifiedNode, Direction, Rule } from "../types";
import { settle } from "./settle";

const CREATING: ReadonlySet<Op> = new Set<Op>(["create"]);

/** R6: one side creates a symbol the other references, so the creator must land first. */
export const r6CreateVsReference: Rule = {
  id: "R6",
  check(pair) {
    if (pair.failedMemory) return null;
    const cases: [ClassifiedNode, ClassifiedNode, Direction][] = [
      [pair.other, pair.next, "new_needs_other"],
      [pair.next, pair.other, "other_needs_new"],
    ];
    for (const [creator, user, direction] of cases) {
      const hit = mutationsReferencedBy(creator, user, CREATING)[0];
      if (hit) {
        return settle(pair, "R6", "ordering_dependency", direction, 0.8, [
          `${hit.ref} is used before its creation (${describeTouch(hit.touch)}) lands`,
        ]);
      }
    }
    return null;
  },
};
