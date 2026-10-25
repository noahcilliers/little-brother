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
    // Agents guess where a teammate will put a new function: one imports requireAdmin from auth/require-admin
    // while the other adds it to auth/require-user. Same distinctive name, different path: below the serialize
    // threshold, so it warns rather than blocks.
    for (const [creator, user, direction] of cases) {
      const named = sameNameReference(creator, user);
      if (named)
        return settle(pair, "R6", "ordering_dependency", direction, 0.65, [
          `${named.name} is imported from ${named.refPath} but is being created in ${named.createdPath}`,
        ]);
    }
    return null;
  },
};

const GENERIC = new Set([
  "default",
  "handler",
  "index",
  "config",
  "options",
  "props",
  "router",
  "server",
  "client",
]);
const nameOf = (id: string) => id.split("::").pop() ?? "";
const pathOf = (id: string) => (id.includes("::") ? (id.split("::")[0] ?? "") : "");

/** A distinctive symbol the creator creates and the user imports under the same name from another path. */
function sameNameReference(creator: ClassifiedNode, user: ClassifiedNode) {
  for (const t of creator.touches) {
    if (t.op !== "create" || !t.symbol) continue;
    const name = nameOf(t.symbol);
    if (name.length < 6 || GENERIC.has(name.toLowerCase())) continue;
    const ref = user.references.find((r) => nameOf(r) === name && pathOf(r) !== pathOf(t.symbol ?? ""));
    if (ref) return { name, refPath: pathOf(ref) || "elsewhere", createdPath: pathOf(t.symbol) || t.path };
  }
  return null;
}
