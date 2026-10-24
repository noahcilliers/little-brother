import type { Doc } from "../_generated/dataModel";
import type { BoardNode } from "./boardNodes";
import { payloadField } from "./shared";

const VERIFY_LIMIT = 3;

function strings(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

/**
 * `lb verify` runs (foreground, or the background merge-tree check) become one check glyph each. The payload is
 * stored as-is, so read it defensively: older rows and the background runner may omit fields.
 */
export function verifyNodes(events: Doc<"events">[]): BoardNode[] {
  return events
    .filter((e) => e.source === "verify")
    .slice(0, VERIFY_LIMIT)
    .map((e) => {
      const branches = strings(payloadField(e, "branches"));
      const conflicts = payloadField(e, "conflicts");
      const conflicted = Array.isArray(conflicts) && conflicts.length > 0;
      const failed = payloadField(e, "passed") === false;
      const what = `${branches.length} branch${branches.length === 1 ? "" : "es"}`;
      const result = conflicted ? "conflicts" : failed ? "tests fail" : "clean";
      return {
        id: `verify:${e._id}`,
        agentId: null,
        glyph: "verify" as const,
        abandoned: false,
        label: conflicted ? "Merge conflict" : failed ? "Merge tests fail" : "Merged clean",
        note: `lb verify: ${what} merged, ${result}.`,
        files: branches.map((path) => ({ path, op: "merged" })),
        at: e.at,
      };
    });
}
