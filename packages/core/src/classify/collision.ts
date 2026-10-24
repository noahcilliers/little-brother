import { isMutation, sharedMutatedPaths, symbolName } from "./touches";
import { ACTION_RANK, type CandidatePair, type ClassifiedNode, type Judgment, type Priority } from "./types";

/** Two agents claiming the same lines or file. Escalations (semantic, intent) go to the topic owner instead. */
const COLLISIONS: ReadonlySet<string> = new Set(["textual_conflict", "duplicate"]);
const PROGRESS_GAP = 2;

export type ClaimBasis = "owner" | "aligned" | "scopeFit" | "progress" | "first";

/** Pushed or merged work is shared history: others rebase onto it instead of colliding with it. */
export function isShared(n: Pick<ClassifiedNode, "landed">): boolean {
  return n.landed === "pushed" || n.landed === "merged";
}

function compare(a: Priority, b: Priority): { winner: "next" | "other" | "tie"; basis: ClaimBasis } {
  for (const key of ["owner", "aligned", "scopeFit"] as const) {
    if (a[key] !== b[key]) return { winner: a[key] ? "next" : "other", basis: key };
  }
  if (Math.abs(a.progress - b.progress) >= PROGRESS_GAP) {
    return { winner: a.progress > b.progress ? "next" : "other", basis: "progress" };
  }
  return { winner: "tie", basis: "first" };
}

/** Whose claim is objectively stronger: owner > aligned with the approved decision > on-task > progress. */
export function resolveCollision(next: Priority, other: Priority): "next" | "other" | "tie" {
  return compare(next, other).winner;
}

/** Why the winner holds, phrased to follow the winner's name ("noah owns db.users"). */
export function claimText(basis: ClaimBasis, topic: string | undefined, winner?: Priority): string {
  const where = topic ?? "this area";
  if (basis === "owner") return `owns ${where}`;
  if (basis === "aligned") return `follows the approved decision on ${where}`;
  if (basis === "scopeFit") return `is assigned to ${where} in its current task`;
  if (basis === "progress") return `is further along (${winner?.progress ?? 0} verified steps)`;
  return "claimed it first";
}

/**
 * Collisions are settled by claim strength, with commit order only as the final tie-break: a stronger
 * newcomer takes over (its action passes, the other side is told to stop), otherwise the existing claim holds.
 */
export function applyCollisionPolicy(
  j: Judgment,
  pair: Partial<Pick<CandidatePair, "next" | "other" | "failedMemory">>,
): Judgment {
  if (!COLLISIONS.has(j.relation) || ACTION_RANK[j.action] < ACTION_RANK.serialize || pair.failedMemory) {
    return j;
  }
  const a = pair.next?.priority;
  const b = pair.other?.priority;
  if (!a || !b) return { ...j, winner: "other" };
  const { winner, basis } = compare(a, b);
  const topic = pair.next?.topic ?? pair.other?.topic;
  const claim = `claim: ${claimText(basis, topic, winner === "next" ? a : b)}`;
  const [first, ...rest] = j.evidence;
  const evidence = first === undefined ? [claim] : [first, claim, ...rest];
  if (winner === "next") return { ...j, action: "ignore", winner: "next", evidence };
  return { ...j, winner: "other", evidence };
}

/** What the losing side should build on instead: the winner's symbols in that file, or the file itself. */
function useAdvice(winner: ClassifiedNode, path: string): string {
  const names = winner.touches
    .filter((t) => t.path === path && t.symbol && isMutation(t))
    .map((t) => symbolName(t.symbol ?? ""))
    .filter((n, i, all) => n && all.indexOf(n) === i)
    .slice(0, 3);
  return names.length ? `use ${names.join(", ")} from ${path}` : `import from ${path} once it lands`;
}

/** Inbox text for the agent whose claim was taken over. Names come from the caller. */
export function takeoverNotice(
  j: Pick<Judgment, "evidence" | "relation" | "type">,
  winner: ClassifiedNode,
  loser: ClassifiedNode,
  winnerName: string,
): string {
  const claim = j.evidence.find((e) => e.startsWith("claim: "))?.slice("claim: ".length) ?? "holds the claim";
  const path = sharedMutatedPaths(winner, loser)[0]?.[0].path ?? winner.touches[0]?.path ?? "this file";
  const type = j.type ?? (j.relation === "duplicate" ? "duplicate" : "conflict");
  return `[little-brother] ${type} · ${winnerName} ${claim} and is taking over ${path}; stop editing it and build on theirs (${useAdvice(winner, path)}).`;
}
