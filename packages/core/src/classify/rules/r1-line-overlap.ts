import { isShared } from "../collision";
import { identicalChange, rangesOverlap, sharedMutatedPaths } from "../touches";
import type { Rule } from "../types";
import { hint, settle } from "./settle";

/**
 * R1: both mutate the same path with overlapping line ranges, unless both made the identical change.
 * Ranges from different base commits may describe different code, so that case only warns.
 */
export const r1LineOverlap: Rule = {
  id: "R1",
  check(pair) {
    if (pair.failedMemory || isShared(pair.other) || isShared(pair.next)) return null;
    for (const [a, b] of sharedMutatedPaths(pair.next, pair.other)) {
      if (a.lines && b.lines && rangesOverlap(a.lines, b.lines)) {
        if (identicalChange(pair.next, pair.other)) {
          return hint("R1", `identical change to ${a.path} on both sides: merges cleanly`);
        }
        const span = `${a.path} lines ${a.lines[0]}-${a.lines[1]} vs ${b.lines[0]}-${b.lines[1]}`;
        const [x, y] = [pair.next.baseRev, pair.other.baseRev];
        if (x && y && x !== y) {
          return settle(pair, "R1", "textual_conflict", "none", 0.6, [
            `both edit ${span}`,
            "different base commits; line ranges may not align",
          ]);
        }
        return settle(pair, "R1", "textual_conflict", "none", 0.95, [`both edit ${span}`]);
      }
    }
    return null;
  },
};
