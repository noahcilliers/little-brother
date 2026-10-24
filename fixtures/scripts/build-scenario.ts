/**
 * Regenerates fixtures/scenario.jsonl and fixtures/hooks/*.json from the demo repo's real files.
 * Run from the repo root: `npx tsx fixtures/scripts/build-scenario.ts`. Step ids match fixtures/expected.md.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Story } from "./events";
import * as s from "./snippets";

const story = new Story();

// Setup: three laptops, three prompts.
story.sessionStart("01-noah-start", 0, "noah");
story.sessionStart("02-joshua-start", 300, "joshua");
story.sessionStart("03-ash-start", 300, "ash");
story.prompt("04-noah-prompt", 800, "noah", "build the user auth workflow");
story.prompt("05-joshua-prompt", 400, "joshua", "build the checkout backend");
story.prompt("06-ash-prompt", 400, "ash", "build the frontend");

// Each agent keeps a task list (TaskCreate/TaskUpdate); `T<nn>` lines are its steps, around the actions they cover.
// Ash's first tasks only read files nobody else touches, so they add bars without adding classifier candidates.
const noahUsers = story.task(
  "T07-noah-users",
  300,
  "noah",
  "Create users table",
  "In-memory users table for login",
);
const ashPages = story.task(
  "T06-ash-pages",
  200,
  "ash",
  "Build pages",
  "Product list, cart and checkout pages",
);
story.read("06a-ash-read-index", 300, "ash", "web/index.html");

// Noah's agent: users table, then the CORS dead end and the proxy that works.
story.write("07-noah-users", 600, "noah", "db/schema/users.ts", s.solution("db/schema/users.ts"));
story.read("06b-ash-read-package", 300, "ash", "package.json");
ashPages("T06-ash-pages.done", 300);
const ashClient = story.task("T06-ash-client", 200, "ash", "API client", "fetch wrapper for /api calls");
noahUsers("T07-noah-users.done", 400);
story.task("T08-noah-cors", 200, "noah", "Allow storefront CORS", "Let the Vite storefront call the API");
story.edit("08-noah-cors", 500, "noah", "src/server.ts", s.shop("src/server.ts"), s.serverWithCors);
ashClient("T06-ash-client.done", 300);
story.bash("09-noah-test", 700, "noah", "npm test", "Run unit tests", s.noahFailedTestOutput, false);
story.edit("10-noah-revert-cors", 1500, "noah", "src/server.ts", s.serverWithCors, s.shop("src/server.ts"));
// Moving on while the CORS task's last test failed: that task ends abandoned.
const noahProxy = story.task(
  "T11-noah-proxy",
  400,
  "noah",
  "Proxy /api in Vite",
  "Same-origin /api via the dev server",
);
story.edit("11-noah-proxy", 300, "noah", "web/vite.config.ts", s.viteProxyOld, s.viteProxyNew);
story.bash("12-noah-test", 1000, "noah", "npm test", "Run unit tests", s.noahPassedTestOutput, true);
noahProxy("T11-noah-proxy.done", 300);
story.stop(
  "13-noah-stop",
  300,
  "noah",
  'Added `db/schema/users.ts` (in-memory users table, seeded demo@shop.dev). I first tried `cors({ origin: "*", credentials: true })` in src/server.ts, but `npm test` failed: browsers reject `Access-Control-Allow-Origin: *` when credentials are allowed. I reverted it and added a Vite `/api` proxy in web/vite.config.ts instead, so the storefront calls the API same-origin. Unit tests pass.',
);

// Duplicate beat: Joshua's agent plans its own users table, is denied, imports Noah's User instead.
story.task("T14-joshua-users", 1500, "joshua", "Create users table", "Customers table for checkout");
story.write("14-joshua-users", 1400, "joshua", "db/schema/users.ts", s.joshuaUsersTable, true);
const joshuaCart = story.task(
  "T15-joshua-cart",
  500,
  "joshua",
  "Cart model",
  "Cart keyed by the shared User",
);
story.edit(
  "15-joshua-cart",
  900,
  "joshua",
  "src/checkout/cart.ts",
  s.shop("src/checkout/cart.ts"),
  s.solution("src/checkout/cart.ts"),
);
joshuaCart("T15-joshua-cart.done", 300);

// Stale beat: Ash's agent sets out to add the CORS middleware Noah's agent proved fails.
story.prompt(
  "16-ash-cors-prompt",
  1200,
  "ash",
  "add CORS middleware to the API so the storefront can call it",
);
story.task("T17-ash-cors", 1500, "ash", "CORS middleware", "cors() on the Express app");
story.edit("17-ash-cors", 900, "ash", "src/server.ts", s.shop("src/server.ts"), s.serverWithCors, true);
const ashProxy = story.task(
  "T18-ash-proxy",
  400,
  "ash",
  "Use the Vite proxy",
  "Route /api through the dev server",
);
story.edit("18-ash-proxy", 700, "ash", "web/vite.config.ts", s.viteProxyOld, s.viteProxyNew);
ashProxy("T18-ash-proxy.done", 300);

// Conflict beat: checkout reads a session cookie while auth moves to JWT bearer.
const joshuaSession = story.task(
  "T19-joshua-session",
  600,
  "joshua",
  "Session handling",
  "Identify the shopper",
);
story.write("19-joshua-session", 800, "joshua", "src/checkout/session.ts", s.joshuaCookieSession);
joshuaSession("T19-joshua-session.done", 300);
story.prompt("20-noah-prompt", 700, "noah", "finish login: issue tokens and protect /api/me");
const noahJwt = story.task("T21-noah-jwt", 300, "noah", "Issue JWT tokens", "jwt.sign on login");
story.edit(
  "21-noah-jwt",
  800,
  "noah",
  "src/auth/issue-token.ts",
  s.shop("src/auth/issue-token.ts"),
  s.solution("src/auth/issue-token.ts"),
);
noahJwt("T21-noah-jwt.done", 1500);
// 8 s from 21.post to 22.pre in total, so the async judge has its verdict before Joshua's next edit.
story.task("T22-joshua-routes", 5800, "joshua", "Checkout routes", "GET /cart and POST /checkout");
story.edit(
  "22-joshua-routes-cookie",
  600,
  "joshua",
  "src/checkout/routes.ts",
  s.joshuaRoutesCookieOld,
  s.joshuaRoutesCookieNew,
  true,
);
story.mcp("23-noah-decision", 2000, "noah", "post_decision", {
  topic: "auth.mechanism",
  value: "jwt-bearer",
  rationale:
    "Stateless JWT in `Authorization: Bearer`; no session store. Checkout must use requireUser/currentUser from src/auth/require-user.ts.",
});
const joshuaJwt = story.task(
  "T24-joshua-session-jwt",
  1000,
  "joshua",
  "Session on JWT",
  "Reuse auth's requireUser",
);
story.edit(
  "24-joshua-session-fix",
  1400,
  "joshua",
  "src/checkout/session.ts",
  s.joshuaCookieSession,
  s.joshuaSessionFixed,
);
joshuaJwt("T24-joshua-session-jwt.done", 300);
const joshuaRoutes = story.task("T25-joshua-routes", 300, "joshua", "Checkout routes", "requireUser + cart");
story.edit(
  "25-joshua-routes",
  600,
  "joshua",
  "src/checkout/routes.ts",
  s.shop("src/checkout/routes.ts"),
  s.solution("src/checkout/routes.ts"),
);
joshuaRoutes("T25-joshua-routes.done", 300);

// Wrap up.
story.stop(
  "26-joshua-stop",
  700,
  "joshua",
  "Checkout backend done: cart keyed by `User`, `POST /api/checkout` behind auth's `requireUser` (JWT bearer, per Noah's decision on auth.mechanism).",
);
story.stop(
  "27-ash-stop",
  500,
  "ash",
  "Storefront calls the API through the Vite `/api` proxy; no CORS middleware needed.",
);
story.stop(
  "28-noah-stop",
  500,
  "noah",
  "Login issues a JWT (`jwt.sign({ userId })`); `/api/me` is protected by `requireUser`.",
);
story.sessionEnd("29-noah-end", 500, "noah");
story.sessionEnd("30-joshua-end", 200, "joshua");
story.sessionEnd("31-ash-end", 200, "ash");

const out = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
writeFileSync(out("scenario.jsonl"), `${story.lines.map((l) => JSON.stringify(l)).join("\n")}\n`);

/** One standalone payload per hook event, picked from the story. */
const samples: Record<string, string> = {
  "session-start": "01-noah-start",
  "user-prompt-submit": "16-ash-cors-prompt",
  "pre-tool-use-write": "14-joshua-users.pre",
  "pre-tool-use-edit": "17-ash-cors.pre",
  "pre-tool-use-bash": "09-noah-test.pre",
  "post-tool-use-bash": "12-noah-test.post",
  "post-tool-use-failure-bash": "09-noah-test.post",
  stop: "13-noah-stop",
  "session-end": "29-noah-end",
  "task-created": "T21-noah-jwt.created",
  "task-completed": "T21-noah-jwt.done",
  "post-tool-use-task-update": "T21-noah-jwt.start",
};
for (const [name, step] of Object.entries(samples)) {
  const line = story.lines.find((l) => l.step === step);
  if (!line || !("input" in line)) throw new Error(`no hook payload for ${step}`);
  writeFileSync(out(`hooks/${name}.json`), `${JSON.stringify(line.input, null, 2)}\n`);
}
console.log(`wrote ${story.lines.length} scenario lines and ${Object.keys(samples).length} hook fixtures`);
