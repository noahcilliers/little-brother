import type { Op } from "../../ingest";
import { describeTouch, mutationsReferencedBy, sharedMutatedPaths, sharedSymbols } from "../touches";
import type { ClassifiedNode, Direction, Rule } from "../types";
import { settle } from "./settle";

const REMOVING: ReadonlySet<Op> = new Set<Op>(["delete", "rename"]);

/** Evidence is phrased neutrally because the same text is shown to both agents. */
function removedButUsed(remover: ClassifiedNode, user: ClassifiedNode): string | null {
  const first = mutationsReferencedBy(remover, user, REMOVING)[0];
  if (first)
    return `${describeTouch(first.touch)} is ${first.touch.op}d on one side but referenced on the other`;
  for (const [r, u] of [...sharedMutatedPaths(remover, user), ...sharedSymbols(remover, user)]) {
    if (REMOVING.has(r.op) && u.op === "write") {
      return `${describeTouch(r)} is ${r.op}d on one side but edited on the other`;
    }
  }
  return null;
}

/** R4: one side deletes or renames what the other writes or references. */
export const r4DeleteVsUse: Rule = {
  id: "R4",
  check(pair) {
    if (pair.failedMemory) return null;
    const cases: [ClassifiedNode, ClassifiedNode, Direction][] = [
      [pair.other, pair.next, "new_needs_other"],
      [pair.next, pair.other, "other_needs_new"],
    ];
    for (const [remover, user, direction] of cases) {
      const what = removedButUsed(remover, user);
      if (what) return settle(pair, "R4", "semantic_conflict", direction, 0.9, [what]);
    }
    return null;
  },
};
