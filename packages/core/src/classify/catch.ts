import type { Action, Relation } from "./types";

// A "catch" is one coordination event between two pieces of work, however many steps re-trigger it. Agents
// take dozens of steps per goal; keying alerts on single steps re-announced the same clash on every edit,
// and every announcement cost the agent a turn.

export type AnchorNode = { _id: string; kind: string; parentId?: string };

/** The work a step belongs to: its goal (the prompt it serves), or itself for plans and lessons. */
export function goalAnchor(n: AnchorNode): string {
  return n.kind === "action" && n.parentId ? n.parentId : n._id;
}

/** One key per pair of goals, order-independent, so A-vs-B and B-vs-A and every later step share it. */
export function catchKey(a: AnchorNode, b: AnchorNode): string {
  return [goalAnchor(a), goalAnchor(b)].sort().join("|");
}

// What an interruption costs the agent: the denial or notice itself, the turn it spends reacting, and the
// tokens it reads to re-plan. Measured in the before/after eval at roughly 1.5–3k for a denial and a few
// hundred for a passive hint; kept as constants until the eval data fits them properly.
export const NUDGE_COST = { deny: 2500, hint: 300 } as const;

// Correctness clashes are about shipping broken code, not tokens, so they are never downgraded.
const NEVER_DOWNGRADE = new Set<Relation>(["semantic_conflict", "intent_contradiction"]);

export type InterventionInput = {
  relation: Relation;
  action: Action;
  confidence: number;
  evidence?: string[];
  direction?: "new_needs_other" | "other_needs_new" | "none";
  /** The same catch was already raised (and its denial shown) for an earlier step of this work. */
  repeat?: boolean;
  /** Tokens the catch would spare (the duplicated task, or the failed attempt behind a lesson); unknown → undefined. */
  avoidedTokens?: number;
};

/**
 * Downgrades a denial to a passive hint when the expected saving can't pay for the interruption: a cheap
 * failure the agent would rediscover in one test run, or a duplicate of a tiny change. Returns the action to
 * apply; never raises one.
 */
export function interventionAction(i: InterventionInput): Action {
  // An interface change (rename, signature change, an imported symbol changing) on separate branches can only be
  // made safe by the side that changes it: the caller's branch doesn't have the new interface, so a caller told to
  // use it either breaks its own code or ignores us (STALE-bench: every merge still broke). So the changer is
  // denied once and told to keep the old interface working; the caller is only told; `repeat` lets later edits by.
  if (isInterfaceChange(i) && (i.action === "block" || i.action === "serialize")) {
    if (i.repeat) return "warn";
    return i.direction === "other_needs_new" ? "serialize" : "warn";
  }
  if (i.action !== "serialize" || NEVER_DOWNGRADE.has(i.relation)) return i.action;
  if (i.avoidedTokens === undefined) return i.action;
  const expected = i.confidence * i.avoidedTokens;
  return expected > NUDGE_COST.deny ? i.action : "warn";
}

/** Settled by the interface rules: R4 (delete/rename vs use), R5 (signature change vs call), R12 (imported symbol). */
export function isInterfaceChange(j: { relation: Relation; evidence?: string[] }): boolean {
  return (
    (j.relation === "semantic_conflict" || j.relation === "ordering_dependency") &&
    (j.evidence ?? []).some((e) => /^R(4|5|12):/.test(e))
  );
}

export type CardNode = {
  files: string[];
  touches: { path: string; symbol?: string; op: string }[];
  preview?: string;
};

const CARD_MAX = 240;

/**
 * What the other side built, small enough to ride inside a denial: the files, the symbols it created or
 * changed, and the head of its diff. Without it agents spent thousands of tokens opening the other branch.
 */
export function contractCard(n: CardNode): string {
  const files = [...new Set([...n.touches.map((t) => t.path), ...n.files])].slice(0, 2);
  const symbols = [
    ...new Set(
      n.touches.filter((t) => t.symbol && t.op !== "delete").map((t) => t.symbol?.split("::").pop()),
    ),
  ].slice(0, 4);
  const code = (n.preview ?? "")
    .split("\n")
    .map((l) => l.replace(/^[+-]\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@@") && !l.startsWith("//") && !l.startsWith("import "))
    .slice(0, 3)
    .join(" ⏎ ");
  const parts = [
    files.length ? files.join(", ") : "",
    symbols.length ? `exports ${symbols.join(", ")}` : "",
    code ? `\`${code}\`` : "",
  ].filter(Boolean);
  const card = parts.join(" · ");
  return card.length > CARD_MAX ? `${card.slice(0, CARD_MAX - 1)}…` : card;
}
