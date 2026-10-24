import { isShared } from "../collision";
import { identicalChange, sharedMutatedPaths, sharedSymbols, symbolName, symbolPath } from "../touches";
import type { ClassifiedNode, Rule } from "../types";
import { settle } from "./settle";

/** What the existing version builds on, so the duplicating side can reuse it instead. */
function reuseAdvice(other: ClassifiedNode, path: string): string[] {
  const refs = other.references
    .map((r) => ({ path: symbolPath(r), name: symbolName(r) }))
    .filter(
      (r) => r.path && r.path !== path && r.path.includes("/") && r.name !== "default" && r.name !== "*",
    )
    .slice(0, 2);
  return refs.length ? [`import ${refs.map((r) => `${r.name} from ${r.path}`).join(", ")} instead`] : [];
}

/** R2: both create the same path or symbol. Two creates of one file are duplicated work, shown as such. */
export const r2SameCreate: Rule = {
  id: "R2",
  check(pair) {
    if (pair.failedMemory || isShared(pair.other) || isShared(pair.next)) return null;
    if (identicalChange(pair.next, pair.other)) return null;
    for (const [a, b] of sharedMutatedPaths(pair.next, pair.other)) {
      if (a.op === "create" && b.op === "create") {
        const r = settle(pair, "R2", "textual_conflict", "none", 0.95, [
          `${a.path} is already being created`,
          ...reuseAdvice(pair.other, a.path),
        ]);
        return r && "judgment" in r ? { judgment: { ...r.judgment, type: "duplicate" } } : r;
      }
    }
    for (const [a, b] of sharedSymbols(pair.next, pair.other)) {
      if (a.op === "create" && b.op === "create" && a.symbol) {
        return settle(pair, "R2", "textual_conflict", "none", 0.95, [`both create ${symbolName(a.symbol)}`]);
      }
    }
    return null;
  },
};
