import { FALLBACK_VERB, type VerbDef } from "./nodes";

/** Pick the verb for a tool call from registry rows (highest priority match wins). */
export function deriveVerb(
  verbs: VerbDef[],
  call: { tool: string; input: string; prevOutcome?: "ok" | "fail" },
): string {
  const sorted = [...verbs].sort((a, b) => b.priority - a.priority);
  for (const v of sorted) {
    for (const r of v.match) {
      if (r.tool && !new RegExp(r.tool).test(call.tool)) continue;
      if (r.input && !new RegExp(r.input).test(call.input)) continue;
      if (r.after === "FAIL" && call.prevOutcome !== "fail") continue;
      return v.key;
    }
  }
  return FALLBACK_VERB;
}
