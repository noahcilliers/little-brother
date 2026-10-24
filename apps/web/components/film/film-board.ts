import type { Board, BoardCatch } from "@/lib/api";
import { at } from "./film-clock";
import { CONFLICT_AT, cid, DECISION } from "./film-decision-data";
import { SESSIONS } from "./film-lines";
import { RESOLVE_AT, TASKS } from "./film-tasks";

// The scripted board the film plays: lb-demo-shop, three teammates, three catches. It has the exact shape of the
// dashboard query, so the film draws it with the dashboard's own components.

const CATCHES: BoardCatch[] = [
  {
    id: "c1",
    classificationId: cid("k1"),
    kind: "duplicate",
    from: "j2",
    to: "n1",
    t: at(11),
    until: at(14.6),
    status: "resolved",
    topic: "db.users",
    chip: "duplicate",
    text: "Joshua's users table duplicates Noah's db.users. Denied before the write.",
    saved: 6_200,
  },
  {
    id: "c2",
    classificationId: cid("k2"),
    kind: "stale",
    from: "a3",
    to: "s1",
    t: at(17),
    until: at(20.6),
    status: "resolved",
    topic: "api.cors",
    chip: "stale",
    text: "Ash heads into Noah's failed CORS path.",
    saved: 9_000,
  },
  {
    id: "c3",
    classificationId: cid("k3"),
    kind: "conflict",
    from: "a5",
    to: "n4",
    t: at(CONFLICT_AT),
    until: at(RESOLVE_AT),
    status: "resolved",
    topic: "auth.mechanism",
    chip: "conflict · auth.mechanism",
    text: "JWT bearer tokens vs cookie session.",
  },
];

// biome-ignore format: tabular scenario data
const BEATS: [s: number, text: string, tone: "hot" | "warn" | "faint"][] = [
  [0.3, "Three agents start on lb-demo-shop", "faint"], [8.4, "Noah's CORS attempt fails", "warn"],
  [10.9, "It becomes a lesson", "faint"], [11, "Joshua stopped: Noah already built the users table", "warn"],
  [17, "Ash steered off a failed path: use the Vite proxy", "warn"], [CONFLICT_AT, "Conflict: Ash vs Noah on auth.mechanism", "hot"],
  [RESOLVE_AT, "Noah decides: JWT bearer", "faint"], [41.2, "lb verify: merged clean, 14 passed", "faint"],
];

const BOARD: Board = {
  repo: "lb-demo-shop",
  agents: [
    {
      id: "joshua",
      handle: "joshua",
      name: "Joshua",
      color: 3,
      branch: "joshua/checkout",
      active: true,
      tokens: 71_100,
    },
    { id: "noah", handle: "noah", name: "Noah", color: 2, branch: "noah/auth", active: true, tokens: 51_900 },
    { id: "ash", handle: "ash", name: "Ash", color: 1, branch: "ash/frontend", active: true, tokens: 47_700 },
  ],
  goals: [
    {
      id: "gj",
      agentId: "joshua",
      label: "checkout backend",
      text: "build the checkout backend",
      t0: at(0.6),
      t1: at(39.6),
    },
    {
      id: "gn1",
      agentId: "noah",
      label: "user auth",
      text: "build the user auth workflow",
      t0: at(0.3),
      t1: at(13.4),
    },
    {
      id: "gn2",
      agentId: "noah",
      label: "issue tokens",
      text: "finish login: issue tokens",
      t0: at(22.5),
      t1: at(35.5),
    },
    { id: "ga1", agentId: "ash", label: "storefront", text: "build the storefront", t0: at(0.9), t1: at(15) },
    { id: "ga2", agentId: "ash", label: "add CORS", text: "add CORS to the API", t0: at(16), t1: at(21.6) },
    {
      id: "ga3",
      agentId: "ash",
      label: "login flow",
      text: "build the login flow",
      t0: at(22.2),
      t1: at(38.2),
    },
  ],
  tasks: TASKS,
  loose: [],
  decisions: [DECISION],
  shared: [
    {
      id: "s1",
      kind: "lesson",
      agentId: "noah",
      t: at(10.9),
      label: "CORS * + credentials fails → use proxy",
      note: "Tried wildcard CORS, browsers reject it with credentials. What worked: Vite proxy.",
      fromTask: "n2",
    },
    {
      id: "s2",
      kind: "decision",
      agentId: "noah",
      t: at(RESOLVE_AT),
      label: "auth.mechanism = JWT bearer",
      note: "Decided by Noah on the dashboard.",
      fromTask: "n4",
    },
  ],
  catches: CATCHES,
  sessions: SESSIONS,
  verifies: [{ id: "v1", t: at(41.2), ok: true, text: "merged clean · 14/14" }],
  beats: BEATS.map(([s, text, tone]) => ({ t: at(s), text, tone })),
  counts: { caught: 3, missed: 0, saved: 0 },
};

/** The board as the dashboard would serve it at story second s: open decisions only, savings so far. */
export function boardAt(s: number): Board {
  const t = at(s);
  const saved = CATCHES.filter((c) => c.t <= t).reduce((n, c) => n + (c.saved ?? 0), 0);
  return {
    ...BOARD,
    decisions: s >= CONFLICT_AT && s < RESOLVE_AT ? [DECISION] : [],
    counts: { ...BOARD.counts, saved },
  };
}

export const FULL_BOARD = BOARD;
