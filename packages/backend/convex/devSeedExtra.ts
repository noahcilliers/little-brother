import type { Handle, SeedAct, SeedTask } from "./devSeedStory";

// Dev only: three more teammates for checking the board with six agents. Goal indices continue after GOALS.

export const EXTRA_GOALS: { a: Handle; t: number; topic: string; prompt: string }[] = [
  { a: "maya", t: 1.0, topic: "search", prompt: "add product search to the storefront" },
  { a: "leo", t: 1.5, topic: "payments", prompt: "wire up Stripe payments" },
  { a: "sam", t: 9.0, topic: "emails", prompt: "send order confirmation emails" },
];

const act = (t: number, tool: string, target: string, label: string): SeedAct => ({
  t,
  tool,
  target,
  label,
  outcome: "succeeded",
});
const task = (
  key: string,
  a: Handle,
  goal: number,
  [t0, t1]: [number, number],
  subject: string,
  topic: string,
  acts: SeedAct[],
): SeedTask => ({ key, a, goal, t0, t1, subject, status: "completed", topic, acts });

export const EXTRA_TASKS: SeedTask[] = [
  task("m1", "maya", 5, [1.3, 4.0], "Search index", "search.index", [
    act(1.6, "Read", "src/products.ts", "read products.ts"),
    act(2.4, "Write", "src/search/index.ts", "create buildIndex()"),
  ]),
  task("m2", "maya", 5, [4.4, 9.5], "Search box", "web.search", [
    act(6.0, "Write", "web/src/SearchBox.tsx", "create SearchBox"),
    act(8.8, "Bash", "npm test", "run npm test"),
  ]),
  // Two tasks of one agent that overlap in time: the row stacks them in sub-lanes.
  task("l1", "leo", 6, [2.0, 9.0], "Stripe client", "payments.stripe", [
    act(3.0, "Write", "src/payments/stripe.ts", "create stripeClient()"),
    act(7.5, "Edit", "src/payments/stripe.ts", "edit createIntent()"),
  ]),
  task("l2", "leo", 6, [5.0, 8.0], "Webhook handler", "payments.webhook", [
    act(6.4, "Write", "src/payments/webhook.ts", "create handleWebhook()"),
  ]),
  task("s1", "sam", 7, [9.4, 13.0], "Email templates", "emails.templates", [
    act(10.5, "Write", "src/emails/order.tsx", "create OrderEmail"),
  ]),
  task("s2", "sam", 7, [13.5, 19.5], "Send on checkout", "emails.send", [
    act(14.0, "Read", "src/checkout/routes.ts", "read routes.ts"),
    act(19.0, "Edit", "src/emails/send.ts", "edit sendOrderEmail()"),
  ]),
];

/** sam's send step needs joshua's checkout routes first. */
export const EXTRA_ORDERING = { t: 14.2, from: "s2", against: "j3" };

// The connector stores ≤40 lines of each change as the node preview; the decision modal shows them as diffs.
export const JWT_DIFF = [
  "@@ -1,6 +1,12 @@",
  ' import jwt from "jsonwebtoken";',
  "-export function issueToken(user: User) {",
  "-  req.session.userId = user.id;",
  "-}",
  "+export function issueToken(user: User): string {",
  '+  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "1h" });',
  "+}",
  "+export function requireAuth(req: Request) {",
  '+  const token = req.headers.authorization?.replace("Bearer ", "");',
  '+  return jwt.verify(token ?? "", JWT_SECRET);',
  "+}",
].join("\n");
export const SESSION_DIFF = [
  "@@ -0,0 +1,8 @@",
  '+import type { Request } from "express";',
  "+",
  "+export function currentUser(req: Request) {",
  "+  const id = req.session.userId;",
  "+  if (!id) throw new HttpError(401);",
  "+  return findUserById(id);",
  "+}",
].join("\n");
export const LOOSE: { a: Handle; t: number; target: string }[] = [
  { a: "noah", t: 7.4, target: "src/auth/session.ts" },
  { a: "ash", t: 6.2, target: "web/src/pages/Cart.tsx" },
];

// What each agent was told; `catch` indexes CATCHES.
// biome-ignore format: one story row per line reads as a table
export const INBOX: { a: Handle; t: number; catch: number; text: string; action: "warn" | "block" }[] = [
  { a: "ash", t: 11.6, catch: 1, action: "warn",
    text: "[little-brother] Noah's agent tried wildcard CORS: browsers reject * with credentials. What worked: Vite proxy." },
  { a: "noah", t: 14.6, catch: 2, action: "warn",
    text: "[little-brother] Joshua's checkout reads a cookie session. You own auth.mechanism: decide." },
  { a: "joshua", t: 14.6, catch: 2, action: "warn",
    text: "[little-brother] Noah switched auth to JWT; your session reads a cookie. Noah decides." },
  { a: "joshua", t: 18.4, catch: 2, action: "block",
    text: "Owner resolved auth.mechanism: Noah set auth.mechanism = JWT. Session handling is superseded." },
];
