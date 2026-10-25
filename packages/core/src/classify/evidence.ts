import { isInterfaceChange } from "./catch";
import { bySeverity } from "./decide";
import { type Judgment, type Relation, TYPE_OF } from "./types";

/** Who sits on the other end of a judgment, as the reader should see them. */
export type Counterpart = {
  name: string; // member handle, supplied by the caller
  active: boolean;
  text: string; // their node's compact signature
  /** What they built (files, exports, head of diff), so the reader can use it without opening their branch. */
  card?: string;
};

const CLAIM = "claim: ";

function strip(evidence: string): string {
  return evidence.replace(/^R\d+: /, "");
}

const NEXT_STEP: Record<Relation, string> = {
  independent: "",
  overlap_compatible: "",
  duplicate: "Use theirs as is (it's described above); you don't need to open their branch.",
  // Headless agents read a bare denial as "stop the task"; the next step must say how to finish it.
  textual_conflict:
    "Not a stop: keep your change out of their lines (add it beside theirs, e.g. as a new function) and retry now, or let theirs land first.",
  semantic_conflict: "Coordinate before changing it; the owner decides.",
  intent_contradiction: "These goals pull in opposite directions; the owner decides.",
  ordering_dependency: "One side must land first.",
  repeats_failure: "Skip that approach; take the one that worked.",
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
  const built = who.card && j.relation !== "repeats_failure" ? ` They built: ${who.card}.` : "";
  // Rules can label a textual clash as duplicated work (two creates of one file); advise by what it is.
  const next =
    j.type === "duplicate"
      ? NEXT_STEP.duplicate
      : isInterfaceChange(j)
        ? j.direction === "other_needs_new"
          ? `Not a stop: ${who.name}'s code calls the old interface on their branch, and only your side can keep the merge working. Keep the old interface working too (an alias for a rename, a default for a new required argument, a compatible type for a new return value), then retry.`
          : "Not a stop: their new interface (shown above) isn't on your branch yet, so keep using the current one here; they're keeping it working for the merge. Carry on with your task."
        : NEXT_STEP[j.relation];
  return `[little-brother] ${j.type ?? TYPE_OF[j.relation]} · ${lead}${built} ${next}`.trim();
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
