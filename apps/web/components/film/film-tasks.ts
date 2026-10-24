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
  ["j1", "joshua", "gj", 1.2, 9.8, "Cart and order models", "done", 23_400, [
    [2, "read src/checkout", "src/checkout", "r"], [3.2, "create Cart", "src/checkout/cart.ts", "w"],
    [5.5, "create Order", "src/checkout/order.ts", "w"], [7.8, "run npm test", "npm test", "w"], [9.2, "update tasks", "", "r"]]],
  ["j2", "joshua", "gj", 10.4, 11.3, "Create users table", "stopped", 600, [
    [11, "create users", "db/schema/users.ts", "d"]]],
  ["j3", "joshua", "gj", 11.8, 15.2, "Import User from auth", "done", 3_100, [
    [12.6, "edit Cart uses User", "src/checkout/cart.ts", "w"], [14.4, "run npm test", "npm test", "w"]]],
  ["j4", "joshua", "gj", 15.8, 29, "Payments with Stripe", "done", 31_200, [
    [16.4, "read stripe docs", "", "r"], [17.5, "create createIntent()", "src/checkout/payments.ts", "w"],
    [22, "create handleStripeEvent()", "src/checkout/webhook.ts", "w"], [27.5, "run npm test", "npm test", "w"]]],
  ["j5", "joshua", "gj", 29.6, 39.6, "Checkout routes", "done", 12_800, [
    [31, "create router", "src/checkout/routes.ts", "w"], [33.6, "read routes.ts", "", "r"],
    [36, "edit POST /checkout", "src/checkout/routes.ts", "w"], [38.8, "run npm test", "npm test", "w"]]],
  ["n1", "noah", "gn1", 1, 6, "Create users table", "done", 18_200, [
    [1.6, "read db/schema", "db/schema", "r"], [2.4, "create users", "db/schema/users.ts", "w"],
    [3.8, "create findUserByEmail()", "db/schema/users.ts", "w"], [5.4, "run migrate", "npm run migrate", "w"]]],
  ["n2", "noah", "gn1", 6.4, 10.6, "Allow storefront CORS", "abandoned", 9_000, [
    [7, "edit app.use(cors)", "src/server.ts", "w", 3_400], [8.4, "run npm test", "npm test", "x", 2_100],
    [10, "revert app.use(cors)", "src/server.ts", "w"]]],
  ["n3", "noah", "gn1", 11, 13.4, "Proxy /api in Vite", "done", 4_000, [
    [12.2, "edit server.proxy", "web/vite.config.ts", "w"], [13.2, "run npm test", "npm test", "w"]]],
  ["n4", "noah", "gn2", 22.8, 28.6, "Issue JWT bearer tokens", "done", 14_600, [
    [24, "edit issueToken()", "src/auth/issue-token.ts", "w"], [25.2, "read auth docs", "", "r"],
    [26.6, "run npm test", "npm test", "w"]]],
  ["n5", "noah", "gn2", 29.2, 35.5, "Protect /api/me", "done", 6_100, [
    [30.4, "edit requireAuth()", "src/api/me.ts", "w"], [34.8, "run npm test", "npm test", "w"]]],
  ["a1", "ash", "ga1", 1.4, 8.6, "Storefront pages", "done", 21_300, [
    [2.6, "create ProductList", "web/src/pages/Products.tsx", "w"], [5, "create Cart", "web/src/pages/Cart.tsx", "w"],
    [7.2, "update tasks", "", "r"]]],
  ["a2", "ash", "ga1", 9, 15, "API client", "done", 7_200, [
    [10.2, "create api()", "web/src/api-client.ts", "w"], [13, "read server.ts", "", "r"]]],
  ["a3", "ash", "ga2", 16.2, 17.1, "CORS middleware", "stopped", 400, [
    [17, "edit app.use(cors)", "src/server.ts", "d"]]],
  ["a4", "ash", "ga2", 17.6, 21.6, "Proxy /api in Vite", "done", 2_600, [
    [18.6, "edit server.proxy", "web/vite.config.ts", "w"], [21, "run curl /api/health", "curl", "w"]]],
  ["a5", "ash", "ga3", 22.4, 28.4, "Cookie session login", "superseded", 11_000, [
    [23.4, "create currentUser()", "src/login/session.ts", "w"], [26.4, "read session docs", "", "r"]]],
  ["a6", "ash", "ga3", 33.4, 38.2, "Bearer token login", "done", 5_200, [
    [34.4, "edit api() sends Bearer", "web/src/api-client.ts", "w"], [37.4, "run npm test", "npm test", "w"]]],
];

const STOP: Partial<Record<string, BoardTask["stopKind"]>> = { j2: "duplicate", a3: "stale" };
export const RESOLVE_AT = 32.6;

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
