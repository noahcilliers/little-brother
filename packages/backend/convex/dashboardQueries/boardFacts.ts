import type { Doc } from "../_generated/dataModel";
import type { FileRef } from "./boardNodes";
import { signatureRest } from "./labels";
import { type Klass, payloadString } from "./shared";

type N = Doc<"nodes">;

export function eventFacts(events: Doc<"events">[]) {
  const denied = new Set<string>();
  const failTail = new Map<string, string>();
  const rationale = new Map<string, string>();
  for (const e of events) {
    if (!e.nodeId) continue;
    // The pre-hook logs a denial with this summary and marks the node superseded (hooks/pre.ts).
    if (e.summary.startsWith("denied ")) denied.add(e.nodeId);
    const tail = payloadString(e, "envelope", "outputTail");
    if (tail) failTail.set(e.nodeId, tail);
    const why = payloadString(e, "args", "rationale");
    if (why) rationale.set(e.nodeId, why);
  }
  return { denied, failTail, rationale };
}

// The verdict that explains a denial, in the order the pre-hook ranks reasons: enforcing actions first,
// then a known failure, a duplicate, a conflict.
const EXPLAINS: Record<Klass["type"], number> = { stale: 0, duplicate: 1, conflict: 2, normal: 3 };
export function blockVerdicts(verdicts: Klass[]): Map<string, Klass> {
  const enforcing = (c: Klass) => (c.action === "serialize" || c.action === "block" ? 0 : 1);
  const out = new Map<string, Klass>();
  for (const c of verdicts) {
    const prev = out.get(c.nodeId);
    const better =
      !prev ||
      enforcing(c) < enforcing(prev) ||
      (enforcing(c) === enforcing(prev) && EXPLAINS[c.type] < EXPLAINS[prev.type]);
    if (better) out.set(c.nodeId, c);
  }
  return out;
}

export function filesOf(n: N): FileRef[] {
  const seen = new Map<string, string>();
  for (const t of n.touches) if (!seen.has(t.path)) seen.set(t.path, t.op);
  for (const f of n.files) if (!seen.has(f)) seen.set(f, n.kind === "knowledge" ? "ref" : "write");
  if (seen.size === 0 && (n.verb === "RUN" || n.verb === "TEST")) {
    const cmd = signatureRest(n);
    if (cmd) seen.set(cmd, "run");
  }
  return [...seen].map(([path, op]) => ({ path, op }));
}
