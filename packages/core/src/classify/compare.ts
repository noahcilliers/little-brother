/** One side of an escalated conflict, as the comparison model sees it. */
export type ComparisonSide = { name: string; work: string[] };

export const COMPARISON_MAX_LINES = 6;

/**
 * Prompt for a short side-by-side of an open escalation once both sides have working code, so the topic
 * owner decides on what was built rather than on what was planned.
 */
export function comparisonPrompt(p: {
  relation: string;
  reason: string;
  sides: [ComparisonSide, ComparisonSide];
  decisions: string[];
}): string {
  const side = (s: ComparisonSide) => `${s.name}:\n${s.work.map((w) => `- ${w}`).join("\n")}`;
  return [
    `Two agents' work is in ${p.relation.replace("_", " ")}: ${p.reason.replace(/^\[little-brother\]\s*/, "")}`,
    side(p.sides[0]),
    side(p.sides[1]),
    `Approved decisions on this topic: ${p.decisions.length ? p.decisions.join("; ") : "none"}`,
    `Write at most ${COMPARISON_MAX_LINES} short lines, no preamble: one line on what each side does (start with their name), the main tradeoff, and which side matches the approved decisions (or "no decision yet").`,
  ].join("\n\n");
}

/** Trim model output to the line budget; empty or missing output stores nothing. */
export function acceptComparison(raw: string | null): string | null {
  if (!raw) return null;
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, COMPARISON_MAX_LINES)
    .map((l) => (l.length > 200 ? `${l.slice(0, 199)}…` : l));
  return lines.length ? lines.join("\n") : null;
}
