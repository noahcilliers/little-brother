// Scripted scenario for the landing film: Cal Hacks demo repo, three agents, three catches.

export const DURATION = 44;
export const LANE_X = [120, 370, 620] as const;
export const NODE_W = 180;
export const rowY = (r: number) => 60 + r * 64;

/** A state change at time t: extra class and corner tag. */
export type Mark = [t: number, cls: string, tag: string];

export const LANES: [name: string, sub: string][] = [
  ["Joshua · checkout", "account C · joshua/checkout"],
  ["Noah · auth", "account B · noah/auth"],
  ["Ash · frontend", "account A · ash/frontend"],
];

export type FilmNode = {
  id: string;
  x: number;
  y: number;
  verb: string;
  l1: string;
  l2: string;
  at: number;
  marks: Mark[];
  extra: string;
};

type Row = [
  id: string,
  lane: number,
  row: number,
  verb: string,
  l1: string,
  l2: string,
  at: number,
  marks?: Mark[],
  extra?: string,
];

// biome-ignore format: tabular scenario data
const NODE_ROWS: Row[] = [
  ["j0", 0, 0, "PLAN", "checkout backend", "carts · orders · payments", 2],
  ["j1", 0, 1, "EDIT", "db.users", "db/schema/users.ts", 11.4, [[12, "flash", "✕ denied"], [13.2, "flag", "✕ denied"]]],
  ["j2", 0, 2, "EDIT", "cart.ts", "import { User } from noah", 13.6],
  ["j3", 0, 5, "EDIT", "session.ts", "req.session.userId", 22, [[25, "flash", "! conflict"], [26.2, "flag", "! conflict"], [30.6, "super", "superseded"]]],
  ["j4", 0, 6, "FIX", "session.ts", "requireAuth() → OK", 33.6],
  ["n0", 1, 0, "PLAN", "auth workflow", "users · tokens · /api/me", 1.4],
  ["n1", 1, 1, "EDIT", "db.users", "db/schema/users.ts", 3.6],
  ["n2", 1, 2, "EDIT", "api.cors", 'cors({ origin: "*" })', 5.4],
  ["n3", 1, 3, "TEST", "api", "credentials rejected → FAIL", 7],
  ["n4", 1, 4, "FIX", "api.cors", "vite proxy /api → OK", 8.6],
  ["n5", 1, 5, "LEARN", "api.cors", "* + creds fails · use proxy", 10.2, [], "know"],
  ["n6", 1, 6, "DECIDE", "auth.mech", "= jwt-bearer", 24.5, [[25, "flash", "! conflict"], [26.2, "flag", "! conflict"], [30.2, "flag", "approved"]]],
  ["a0", 2, 0, "PLAN", "storefront", "pages · cart · account", 2.6],
  ["a1", 2, 1, "EXPLORE", "web/src", "routes · api client", 6.4],
  ["a2", 2, 2, "PLAN", "api.cors", "add CORS middleware", 16.2, [[16.8, "flash", "⚠ stale"], [18, "flag", "⚠ stale"]]],
  ["a3", 2, 3, "EDIT", "vite.config.ts", "proxy /api → OK", 19.4],
];

const VERIFY: FilmNode = {
  id: "v",
  x: 170,
  y: 508,
  verb: "TEST",
  l1: "integration · 3 branches merged",
  l2: "14 passed · 0 failed → OK",
  at: 37,
  marks: [[38.6, "flag", "verified"]],
  extra: "wide",
};

export const NODES: FilmNode[] = [
  ...NODE_ROWS.map(([id, lane, row, verb, l1, l2, at, marks = [], extra = ""]) => ({
    id,
    x: (LANE_X[lane] ?? 0) - NODE_W / 2,
    y: rowY(row),
    verb,
    l1,
    l2,
    at,
    marks,
    extra,
  })),
  VERIFY,
];

export type FilmEdge = {
  id: string;
  d: string;
  at: number;
  cls: string;
  label: string;
  lx: number;
  ly: number;
  ends: string[];
  marks: Mark[];
};

type EdgeRow = [
  id: string,
  d: string,
  at: number,
  cls: string,
  label: string,
  lx: number,
  ly: number,
  ends: string[],
  marks?: Mark[],
];

// biome-ignore format: tabular scenario data
const EDGE_ROWS: EdgeRow[] = [
  ["e-dup", "M210 146 L280 146", 12, "dup", "duplicate", 245, 138, ["j1", "n1"]],
  ["e-stale", "M530 210 C495 210 495 402 460 402", 16.8, "stale", "stale", 495, 309, ["a2", "n5"]],
  ["e-conf", "M210 402 C245 402 245 466 280 466", 25, "conf", "conflict", 245, 437, ["j3", "n6"], [[30.6, "soft", "resolved"]]],
  ["e-fix", "M120 424 L120 444", 33.6, "soft", "", 0, 0, ["j3", "j4"]],
  ["e-v1", "M120 488 C120 528 140 528 170 528", 37, "soft", "", 0, 0, ["j4", "v"]],
  ["e-v2", "M370 488 L370 508", 37, "soft", "", 0, 0, ["n6", "v"]],
  ["e-v3", "M620 296 C620 528 600 528 570 528", 37, "soft", "", 0, 0, ["a3", "v"]],
];

export const EDGES: FilmEdge[] = EDGE_ROWS.map(([id, d, at, cls, label, lx, ly, ends, marks = []]) => ({
  id,
  d,
  at,
  cls,
  label,
  lx,
  ly,
  ends,
  marks,
}));
