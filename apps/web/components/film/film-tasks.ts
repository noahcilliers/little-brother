import type { BoardTask } from "@/lib/api";
import { at } from "./film-clock";

// Each agent's own task list for the film, in story seconds. Same shape the dashboard query returns.

type Outcome = BoardTask["actions"][number]["outcome"];
/** w: real work · r: routine (read, plan bookkeeping) · x: failed · d: denied by little brother. */
type Act = [s: number, label: string, file: string, kind: "w" | "r" | "x" | "d", tokens?: number];
type Row = [
  id: string,
  agentId: string,
  goalId: string,
  t0: number,
  t1: number,
  subject: string,
  state: BoardTask["state"],
  tokens: number,
  acts: Act[],
];

const OUTCOME: Record<Act[3], Outcome> = { w: "succeeded", r: "succeeded", x: "failed", d: "superseded" };

// biome-ignore format: one task per row reads like the task lists it depicts
const ROWS: Row[] = [
  ["j1", "joshua", "gj", 15.6, 19.6, "Cart and order models", "done", 23_400, [
    [16, "read src/checkout", "src/checkout", "r"], [16.4, "create Cart", "src/checkout/cart.ts", "w"],
    [17.4, "create Order", "src/checkout/order.ts", "w"], [18.6, "run npm test", "npm test", "w"]]],
  ["j2", "joshua", "gj", 19.9, 20.7, "Create users table", "stopped", 600, [
    [20.5, "create users", "db/schema/users.ts", "d"]]],
  ["j3", "joshua", "gj", 21, 24.8, "Import User from auth", "done", 3_100, [
    [21.8, "edit Cart uses User", "src/checkout/cart.ts", "w"], [23.6, "run npm test", "npm test", "w"]]],
  ["j4", "joshua", "gj", 25.2, 40.5, "Payments with Stripe", "done", 31_200, [
    [26, "read stripe docs", "", "r"], [27.2, "create createIntent()", "src/checkout/payments.ts", "w"],
    [31.6, "create handleStripeEvent()", "src/checkout/webhook.ts", "w"], [38.4, "run npm test", "npm test", "w"]]],
  ["n1", "noah", "gn1", 9.4, 14.4, "Create users table", "done", 18_200, [
    [10.2, "read db/schema", "db/schema", "r"], [11, "create users", "db/schema/users.ts", "w"],
    [12.4, "create findUserByEmail()", "db/schema/users.ts", "w"], [13.8, "run migrate", "npm run migrate", "w"]]],
  ["n2", "noah", "gn1", 14.8, 19, "Allow storefront CORS", "abandoned", 9_000, [
    [15.6, "edit app.use(cors)", "src/server.ts", "w", 3_400], [17.6, "run npm test", "npm test", "x", 2_100],
    [18.6, "revert app.use(cors)", "src/server.ts", "w"]]],
  ["n3", "noah", "gn1", 19.4, 22.4, "Proxy /api in Vite", "done", 4_000, [
    [20.4, "edit server.proxy", "web/vite.config.ts", "w"], [22, "run npm test", "npm test", "w"]]],
  ["n4", "noah", "gn2", 27.4, 32.6, "Issue JWT bearer tokens", "done", 14_600, [
    [29.6, "edit issueToken()", "src/auth/issue-token.ts", "w"], [30.6, "read auth docs", "", "r"],
    [32.2, "run npm test", "npm test", "w"]]],
  ["n5", "noah", "gn2", 33, 40.6, "Protect /api/me", "done", 6_100, [
    [34.4, "edit requireAuth()", "src/api/me.ts", "w"], [39.6, "run npm test", "npm test", "w"]]],
  ["a1", "ash", "ga1", 15.2, 23, "Storefront pages", "done", 21_300, [
    [16, "create ProductList", "web/src/pages/Products.tsx", "w"], [18, "create Cart", "web/src/pages/Cart.tsx", "w"],
    [21, "update tasks", "", "r"]]],
  ["a2", "ash", "ga2", 23.4, 24.5, "CORS middleware", "stopped", 400, [
    [24.4, "edit app.use(cors)", "src/server.ts", "d"]]],
  ["a3", "ash", "ga2", 24.9, 28, "Proxy /api in Vite", "done", 2_600, [
    [25.6, "edit server.proxy", "web/vite.config.ts", "w"], [27.4, "run curl /api/health", "curl", "w"]]],
  ["a4", "ash", "ga3", 28.4, 32.8, "Cookie session login", "superseded", 11_000, [
    [29.2, "create currentUser()", "src/login/session.ts", "w"], [31, "read session docs", "", "r"]]],
  ["a5", "ash", "ga3", 37.6, 40.8, "Bearer token login", "done", 5_200, [
    [38.2, "edit api() sends Bearer", "web/src/api-client.ts", "w"], [40.2, "run npm test", "npm test", "w"]]],
];

const STOP: Partial<Record<string, BoardTask["stopKind"]>> = { j2: "duplicate", a2: "stale" };
export const RESOLVE_AT = 36.8;

export const TASKS: BoardTask[] = ROWS.map(([id, agentId, goalId, t0, t1, subject, state, tokens, acts]) => ({
  id,
  agentId,
  goalId,
  subject,
  state,
  t0: at(t0),
  t1: at(t1),
  tokens,
  inferred: false,
  stopKind: STOP[id],
  supersededAt: state === "superseded" ? at(RESOLVE_AT) : undefined,
  actions: acts.map(([s, label, file, kind, actTokens], i) => ({
    id: `${id}.${i}`,
    t: at(s),
    label,
    file: file || undefined,
    outcome: OUTCOME[kind],
    routine: kind === "r",
    tokens: actTokens,
  })),
}));
