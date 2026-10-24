import type { Board, BoardCatch, BoardGoal } from "@/lib/api";
import { at } from "./film-clock";
import { CONFLICT_AT, cid, DECISION } from "./film-decision-data";
import { RESOLVE_AT, TASKS } from "./film-tasks";
import { BEAT } from "./film-timeline";

// The scripted board the film plays: lb-demo-shop, three teammates, three catches. It has the exact shape of the
// dashboard query, so the film draws it with the dashboard's own components.

const catchRow = (
  id: string,
  kind: BoardCatch["kind"],
  [from, to]: [string, string],
  [t, until]: [number, number],
  chip: string,
  text: string,
  saved?: number,
): BoardCatch => ({
  id,
  classificationId: cid(`k${id}`),
  kind,
  from,
  to,
  t: at(t),
  until: at(until),
  status: "resolved",
  chip,
  text,
  saved,
});

export const CATCHES: BoardCatch[] = [
  catchRow("c1", "duplicate", ["j2", "n1"], [BEAT.dup, 23.4], "duplicate", "Joshua's users table duplicates Noah's db.users.", 6_200),
  catchRow("c2", "stale", ["a2", "s1"], [BEAT.stale, 27.4], "stale", "Ash heads into Noah's failed CORS path.", 2_300),
  catchRow("c3", "conflict", ["a4", "n4"], [CONFLICT_AT, RESOLVE_AT], "conflict · auth.mechanism", "JWT bearer tokens vs cookie session."),
];

const goal = (id: string, agentId: string, label: string, text: string, t0: number, t1: number): BoardGoal => ({
  id,
  agentId,
  label,
  text,
  t0: at(t0),
  t1: at(t1),
});

// biome-ignore format: tabular scenario data
const BEATS: [s: number, text: string, tone: "hot" | "warn" | "faint"][] = [
  [BEAT.noahIn, "Noah joined", "faint"], [BEAT.ashIn, "Ash joined", "faint"], [BEAT.joshIn, "Joshua joined", "faint"],
  [17.6, "Noah's CORS attempt fails", "warn"], [19.2, "It becomes a lesson", "faint"],
  [BEAT.dup, "Joshua stopped: Noah already built the users table", "warn"],
  [BEAT.stale, "Ash steered off a failed path: use the Vite proxy", "warn"],
  [CONFLICT_AT, "Conflict: Ash vs Noah on auth.mechanism", "hot"], [RESOLVE_AT, "Noah decides: JWT bearer", "faint"],
];

export const FULL_BOARD: Board = {
  repo: "lb-demo-shop",
  agents: [
    { id: "joshua", handle: "joshua", name: "Joshua", color: 3, branch: "joshua/checkout", active: true, tokens: 58_300 },
    { id: "noah", handle: "noah", name: "Noah", color: 2, branch: "noah/auth", active: true, tokens: 51_900 },
    { id: "ash", handle: "ash", name: "Ash", color: 1, branch: "ash/frontend", active: true, tokens: 40_500 },
  ],
  goals: [
    goal("gj", "joshua", "checkout backend", "build the checkout backend", 15.2, 40.5),
    goal("gn1", "noah", "user auth", "build the user auth workflow", 9.2, 22.4),
    goal("gn2", "noah", "issue tokens", "finish login: issue tokens", 27, 40.6),
    goal("ga1", "ash", "storefront", "build the storefront", 14.8, 23),
    goal("ga2", "ash", "add CORS", "add CORS to the API", 23.2, 28),
    goal("ga3", "ash", "login flow", "build the login flow", 28.2, 40.8),
  ],
  tasks: TASKS,
  loose: [],
  decisions: [DECISION],
  shared: [
    { id: "s1", kind: "lesson", agentId: "noah", t: at(19.2), label: "CORS * + credentials fails → use proxy", note: "Tried wildcard CORS; browsers reject it with credentials. What worked: Vite proxy.", fromTask: "n2" },
    { id: "s2", kind: "decision", agentId: "noah", t: at(RESOLVE_AT), label: "auth.mechanism = JWT bearer", note: "Decided by Noah.", fromTask: "n4" },
  ],
  catches: CATCHES,
  sessions: [],
  verifies: [],
  beats: BEATS.map(([s, text, tone]) => ({ t: at(s), text, tone })),
  counts: { caught: 3, missed: 0, saved: 0 },
};

const JOIN: Record<string, number> = { noah: BEAT.noahIn, ash: BEAT.ashIn, joshua: BEAT.joshIn };

/** Who is on the board at story second s: lanes appear as each person joins. */
export function joinedAt(s: number): string[] {
  return FULL_BOARD.agents.filter((a) => s >= (JOIN[a.id] ?? 0)).map((a) => a.id);
}

/** The board as the dashboard would serve it at story second s. */
export function boardAt(s: number): Board {
  const t = at(s);
  const ids = new Set(joinedAt(s));
  const saved = CATCHES.filter((c) => c.t <= t).reduce((n, c) => n + (c.saved ?? 0), 0);
  return {
    ...FULL_BOARD,
    agents: FULL_BOARD.agents.filter((a) => ids.has(a.id)),
    decisions: s >= CONFLICT_AT && s < RESOLVE_AT ? [DECISION] : [],
    counts: { ...FULL_BOARD.counts, saved },
  };
}
