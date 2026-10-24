import type { PaneKey } from "./film-story";

// Session transcripts shown in the focused pane, and the event table's rows.

export type LineKind = "prompt" | "text" | "tool" | "res" | "ok" | "cmd" | "lb";
/** `lb` lines are "head|body": a little-brother message pushed into the session. */
export type Thought = [pane: PaneKey, t: number, kind: LineKind, text: string];

// biome-ignore format: one transcript line per row reads like the session it depicts
export const THOUGHTS: Thought[] = [
  ["joshua", 0.5, "prompt", "build the checkout backend"],
  ["joshua", 2, "text", "Plan: 1 users table · 2 auth · 3 cart · 4 checkout + payments."],
  ["joshua", 11, "tool", "Write(db/schema/users.ts)"],
  ["joshua", 12, "lb", "duplicate · denied|db.users is owned by Noah (agent active). Import User from src/contracts/user.ts."],
  ["joshua", 12.9, "text", "Noah owns users and auth. Skipping steps 1 and 2."],
  ["joshua", 13.6, "tool", "Edit(src/checkout/cart.ts)"],
  ["joshua", 14, "res", 'import { User } from "@/contracts/user"'],
  ["joshua", 21.2, "text", "Checkout needs the signed-in user. Reading it from the session."],
  ["joshua", 22, "tool", "Write(src/checkout/session.ts)"],
  ["joshua", 22.4, "res", "const id = req.session.userId"],
  ["joshua", 31.3, "lb", "channel · approved update|auth.mechanism = jwt-bearer, approved by Noah. session.ts is superseded. Use requireAuth(req)."],
  ["joshua", 32.4, "text", "Switching checkout to bearer tokens."],
  ["joshua", 33.6, "tool", "Edit(src/checkout/session.ts)"],
  ["joshua", 34.4, "ok", "pnpm test checkout · 6 passed"],
  ["ash", 15, "prompt", "add CORS middleware to the API so the storefront can call it"],
  ["ash", 16.8, "lb", 'stale · before you start|Noah\'s agent tried cors({ origin: "*" }) with credentials. Browsers reject it (9 min, 3 test runs). What worked: Vite proxy /api → :3000.'],
  ["ash", 17.9, "text", "Skipping the middleware. Adding the proxy instead."],
  ["ash", 19.4, "tool", "Edit(web/vite.config.ts)"],
  ["ash", 20.2, "ok", "GET /api/me via proxy · 200"],
  ["noah", 23.4, "text", "Sessions need a store we don't have. Switching to stateless JWT."],
  ["noah", 24, "tool", "Edit(src/auth/issue-token.ts)"],
  ["noah", 24.5, "tool", "little-brother · post_decision(auth.mechanism, jwt-bearer)"],
  ["noah", 25.3, "lb", "conflict · you own this|Joshua's checkout reads req.session (cookie-session). Decide on the dashboard."],
  ["verify", 36.4, "cmd", "$ lb verify joshua/checkout noah/auth ash/frontend"],
  ["verify", 37, "res", "merged 3 branches into a temp worktree"],
  ["verify", 37.5, "cmd", "$ pnpm test:integration"],
  ["verify", 38.6, "ok", "14 passed · 0 failed"],
  ["verify", 39.2, "res", "3 catches before push · nothing to fix at merge"],
];

export type EventType = "normal" | "duplicate" | "stale" | "conflict";
export type FilmEvent = [t: number, who: string, sig: string, type: EventType];

// biome-ignore format: tabular scenario data
export const EVENTS: FilmEvent[] = [
  [1.4, "noah", "PLAN auth workflow", "normal"], [2, "joshua", "PLAN checkout backend", "normal"],
  [2.6, "ash", "PLAN storefront", "normal"], [3.6, "noah", "EDIT db.users", "normal"],
  [5.4, "noah", "EDIT api.cors cors(*)", "normal"], [7, "noah", "TEST api → FAIL", "normal"],
  [8.6, "noah", "FIX api.cors proxy → OK", "normal"], [10.2, "noah", "LEARN api.cors", "normal"],
  [12, "joshua", "EDIT db.users", "duplicate"], [13.6, "joshua", "EDIT cart.ts", "normal"],
  [16.8, "ash", "PLAN api.cors middleware", "stale"], [19.4, "ash", "EDIT vite.config.ts", "normal"],
  [22, "joshua", "EDIT session.ts", "normal"], [25, "noah", "DECIDE auth.mech = jwt", "conflict"],
  [30.2, "noah", "RESOLVE auth.mech → jwt", "normal"], [33.6, "joshua", "FIX session.ts → OK", "normal"],
  [38.6, "lb", "TEST integration → OK", "normal"],
];
