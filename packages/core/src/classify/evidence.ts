import { bySeverity } from "./decide";
import { type Judgment, type Relation, TYPE_OF } from "./types";

/** Who sits on the other end of a judgment, as the reader should see them. */
export type Counterpart = {
  name: string; // member handle, supplied by the caller
  active: boolean;
  text: string; // their node's compact signature
};

const CLAIM = "claim: ";

function strip(evidence: string): string {
  return evidence.replace(/^R\d+: /, "");
}

const NEXT_STEP: Record<Relation, string> = {
  independent: "",
  overlap_compatible: "",
  duplicate: "Reuse their work instead of redoing it.",
  textual_conflict: "Let it land first, or work on something else meanwhile.",
  semantic_conflict: "Coordinate before changing it; the owner decides.",
  intent_contradiction: "These goals pull in opposite directions; the owner decides.",
  ordering_dependency: "One side must land first.",
  repeats_failure: "Try a different approach.",
};

function line(j: Judgment, who: Counterpart): string {
  const status = who.active ? "agent active" : "agent idle";
  const own = j.evidence.filter((e) => !e.startsWith("retrieved:"));
  let lead: string;
  if (j.relation === "repeats_failure") {
    const exact = own.find((e) => e.startsWith("R10: "));
    const repeat = exact ? ` ${strip(exact).split(":")[0]}.` : "";
    lead = `already failed for ${who.name}: ${who.text}.${repeat}`;
  } else {
    const [first, ...more] = own.map(strip);
    // Claims describe the side that holds the file, which is always the counterpart in this rendering.
    const claims = more.filter((e) => e.startsWith(CLAIM)).map((e) => `${who.name} ${e.slice(CLAIM.length)}`);
    const extra = more.filter((e) => !e.startsWith("judge:") && !e.startsWith(CLAIM)).slice(0, 1);
    lead = [
      `${first ?? who.text} · ${who.name} (${status}): ${who.text}.`,
      ...[...claims.slice(0, 1), ...extra].map((e) => `${e}.`),
    ].join(" ");
  }
  return `[little-brother] ${j.type ?? TYPE_OF[j.relation]} · ${lead} ${NEXT_STEP[j.relation]}`.trim();
}

/**
 * Short text for deny reasons and inbox items, most severe first, one line per non-ignored judgment.
 * Names come from the caller because judgments only carry node ids.
 */
export function renderEvidence(
  judgments: Judgment[],
  counterpart: (j: Judgment) => Counterpart,
  max = 3,
): string {
  const shown = judgments.filter((j) => j.action !== "ignore").sort(bySeverity);
  const lines = shown.slice(0, max).map((j) => line(j, counterpart(j)));
  if (shown.length > max) lines.push(`[little-brother] …and ${shown.length - max} more`);
  return lines.join("\n");
}
