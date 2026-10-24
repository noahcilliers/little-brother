import { JWT_DIFF, SESSION_DIFF } from "./devSeedExtra";

// Dev only: the §8 demo story as data, in story seconds (devSeed scales them to wall time).
// Mirrors the approved dashboard prototype so the board can be built and checked before real task data exists.

export type Handle = "noah" | "ash" | "joshua" | "maya" | "leo" | "sam";
export type SeedAct = {
  t: number;
  tool: string;
  target: string;
  label: string;
  outcome: "succeeded" | "failed" | "superseded";
  tail?: string;
  deny?: string;
  preview?: string;
};
type Status = "completed" | "abandoned" | "stopped" | "superseded";
export type SeedTask = {
  key: string;
  a: Handle;
  goal: number;
  t0: number;
  t1: number;
  subject: string;
  status: Status;
  topic: string;
  acts: SeedAct[];
  note?: string;
  supersededAt?: number;
};

// Lane order on the board follows agent creation; color follows member order.
export const HANDLES: Handle[] = ["noah", "ash", "joshua"];
export const EXTRA_HANDLES: Handle[] = ["maya", "leo", "sam"];
export const BRANCH: Record<Handle, string> = {
  noah: "noah/auth",
  ash: "ash/frontend",
  joshua: "joshua/checkout",
  maya: "maya/search",
  leo: "leo/payments",
  sam: "sam/emails",
};

export const GOALS: { a: Handle; t: number; topic: string; prompt: string }[] = [
  { a: "noah", t: 0.3, topic: "auth", prompt: "build the user auth workflow" },
  { a: "noah", t: 13.0, topic: "auth", prompt: "finish login: issue tokens and protect /api/me" },
  { a: "ash", t: 0.6, topic: "web", prompt: "build the storefront" },
  { a: "ash", t: 11.0, topic: "api", prompt: "add CORS to the API, so the storefront can call it" },
  { a: "joshua", t: 7.8, topic: "checkout", prompt: "build the checkout backend" },
];

type ActRow = [number, string, string, string, string?];
const ok = ([t, tool, target, label, tail]: ActRow): SeedAct => ({
  t,
  tool,
  target,
  label,
  outcome: "succeeded",
  tail,
});
const fail = ([t, tool, target, label, tail]: ActRow): SeedAct => ({
  t,
  tool,
  target,
  label,
  outcome: "failed",
  tail,
});
const deny = ([t, tool, target, label, why]: ActRow): SeedAct => ({
  t,
  tool,
  target,
  label,
  outcome: "superseded",
  deny: why,
});

type TaskRow = [string, Handle, number, number, number, string, Status, string, SeedAct[], string?];
const task = ([key, a, goal, t0, t1, subject, status, topic, acts, note]: TaskRow): SeedTask => ({
  key,
  a,
  goal,
  t0,
  t1,
  subject,
  status,
  topic,
  acts,
  note,
});
const TEST = "npm test";

// biome-ignore format: one story row per line reads as a table
export const TASKS: SeedTask[] = [
  task(["n1", "noah", 0, 0.6, 2.3, "Create users table", "completed", "db.users", [
    ok([1.1, "Write", "db/schema/users.ts", "create users"]),
    ok([1.8, "Edit", "db/schema/users.ts", "create findUserByEmail()"]),
  ]]),
  task(["n2", "noah", 0, 2.6, 5.2, "Allow storefront CORS", "abandoned", "api.cors", [
    ok([2.8, "Read", "src/server.ts", "read server.ts"]),
    ok([3.0, "Edit", "src/server.ts", "edit app.use(cors)"]),
    fail([4.2, "Bash", TEST, "run npm test", "browsers reject * with credentials"]),
    ok([5.0, "Edit", "src/server.ts", "revert app.use(cors)"]),
  ], "Tests failed: browsers reject * with credentials."]),
  task(["n3", "noah", 0, 5.4, 6.9, "Proxy /api in Vite", "completed", "web.proxy", [
    ok([6.0, "Edit", "web/vite.config.ts", "edit server.proxy"]),
    ok([6.6, "Bash", TEST, "run npm test", "9 passed"]),
  ]]),
  task(["n4", "noah", 1, 13.4, 15.2, "Issue JWT tokens", "completed", "auth.mechanism", [
    { ...ok([14.2, "Edit", "src/auth/issue-token.ts", "edit issueToken()"]), preview: JWT_DIFF },
    ok([14.9, "Bash", TEST, "run npm test", "11 passed"]),
  ]]),
  task(["a1", "ash", 2, 0.9, 2.9, "Build pages", "completed", "web.pages", [
    ok([1.6, "Write", "web/src/pages/Cart.tsx", "create Cart"]),
    ok([2.5, "Write", "web/src/pages/Products.tsx", "create ProductList"]),
  ]]),
  task(["a2", "ash", 2, 3.1, 4.6, "API client", "completed", "web.api", [
    ok([3.8, "Write", "web/src/api-client.ts", "create api()"]),
  ]]),
  task(["a3", "ash", 3, 11.5, 12.3, "CORS middleware", "stopped", "api.cors", [
    deny([12.2, "Edit", "src/server.ts", "edit app.use(cors)", "stale · exact repeat of a known-failing change."]),
  ], "Stopped before the edit: Noah's agent tried this and it failed. Use the Vite proxy."]),
  task(["a4", "ash", 3, 12.7, 13.8, "Use the Vite proxy", "completed", "web.proxy", [
    ok([13.4, "Edit", "web/vite.config.ts", "edit server.proxy"]),
  ]]),
  task(["j1", "joshua", 4, 8.1, 8.7, "Create users table", "stopped", "db.users", [
    deny([8.6, "Write", "db/schema/users.ts", "create users", "duplicate · Noah owns db.users and built it. Import User from src/contracts/user.ts."]),
  ], "Stopped: Noah owns db.users and already built it. Import User instead."]),
  task(["j2", "joshua", 4, 9.1, 10.6, "Cart model", "completed", "checkout.cart", [
    ok([10.0, "Edit", "src/checkout/cart.ts", "edit Cart uses User"]),
  ]]),
  {
    ...task(["j3", "joshua", 4, 11.0, 12.6, "Session handling", "superseded", "auth.mechanism", [
      { ...ok([11.6, "Write", "src/checkout/session.ts", "create currentUser() via req.session"]), preview: SESSION_DIFF },
      ok([12.2, "Read", "src/checkout/cart.ts", "read cart.ts"]),
    ], "Built on cookie sessions; superseded when the owner chose JWT."]),
    supersededAt: 18.4,
  },
  task(["j4", "joshua", 4, 16.0, 16.5, "Checkout routes", "stopped", "checkout.routes", [
    deny([16.4, "Edit", "src/checkout/routes.ts", "edit router (cookies)", "conflict · auth.mechanism conflict is open."]),
  ], "Stopped while the auth conflict is open."]),
  task(["j5", "joshua", 4, 19.0, 20.2, "Session on JWT", "completed", "auth.mechanism", [
    ok([19.6, "Edit", "src/checkout/session.ts", "edit currentUser() via requireAuth()"]),
  ]]),
  task(["j6", "joshua", 4, 20.5, 21.6, "Checkout routes", "completed", "checkout.routes", [
    ok([21.0, "Edit", "src/checkout/routes.ts", "edit router"]),
    ok([21.4, "Bash", TEST, "run npm test", "14 passed"]),
  ]]),
];

export const LESSON = {
  a: "noah" as Handle,
  t: 5.6,
  goal: 0,
  text: "LEARN api.cors Tried wildcard CORS → failed (browsers reject * with credentials) → worked: Vite proxy.",
};
export const DECISION = {
  a: "noah" as Handle,
  t: 18.4,
  from: "n4",
  text: "DECIDE auth.mechanism = JWT tokens",
};

export type SeedCatch = {
  t: number;
  type: "duplicate" | "stale" | "conflict";
  from: string;
  against: string;
  relation: string;
  action: "warn" | "block";
  reason: string;
  resolvedAt?: number;
  comparison?: string;
};
// biome-ignore format: one story row per line reads as a table
export const CATCHES: SeedCatch[] = [
  { t: 8.6, type: "duplicate", from: "j1", against: "n1", relation: "duplicates", action: "block",
    reason: "[little-brother] duplicate · Joshua's users table duplicates Noah's db.users." },
  { t: 11.6, type: "stale", from: "a3", against: "lesson", relation: "repeats_failure", action: "block",
    reason: "[little-brother] stale · Ash heads into Noah's failed CORS path." },
  { t: 14.6, type: "conflict", from: "j3", against: "n4", relation: "intent_contradiction", action: "block", resolvedAt: 18.4,
    reason: "[little-brother] conflict · judge: issueToken() moves auth to JWT bearer tokens while currentUser() reads a cookie session; checkout would never see a logged-in user.",
    comparison: [
      "Noah: issueToken() signs a JWT; requireAuth() reads the Authorization header.",
      "Joshua: currentUser() reads req.session.userId from a cookie session.",
      "Each passes its own tests; merged, checkout never sees a logged-in user.",
    ].join("\n") },
];

export const VERIFY_AT = 22.4;
