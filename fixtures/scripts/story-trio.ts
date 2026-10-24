/**
 * The original three agents (PLAN §8): noah on auth, joshua on checkout, ash on the storefront. Step ids match
 * fixtures/expected.md; `T<nn>` lines are each agent's own task list around the actions they cover.
 */
import type { Story } from "./events";
import * as s from "./snippets";
import * as team from "./snippets-team";

/** Noah: users table, the CORS dead end and the proxy that works. */
export function noahFirstPrompt(story: Story) {
  const users = story.task("T07-noah-users", 900, "noah", "Create users table", "In-memory users table for login");
  story.read("07a-noah-read-index", 600, "noah", "src/index.ts");
  story.write("07-noah-users", 1200, "noah", "db/schema/users.ts", s.solution("db/schema/users.ts"));
  users("T07-noah-users.done", 600);
  story.task("T08-noah-cors", 500, "noah", "Allow storefront CORS", "Let the Vite storefront call the API");
  story.read("08a-noah-read-test", 700, "noah", "test/unit/storefront-access.test.ts");
  story.edit("08-noah-cors", 1200, "noah", "src/server.ts", s.shop("src/server.ts"), s.serverWithCors);
  story.bash("09-noah-test", 1500, "noah", "npm test", "Run unit tests", s.noahFailedTestOutput, false);
  story.edit("10-noah-revert-cors", 2500, "noah", "src/server.ts", s.serverWithCors, s.shop("src/server.ts"));
  // Moving on while the CORS task's last test failed: that task ends abandoned.
  const proxy = story.task("T11-noah-proxy", 800, "noah", "Proxy /api in Vite", "Same-origin /api via the dev server");
  story.edit("11-noah-proxy", 1200, "noah", "web/vite.config.ts", s.viteProxyOld, s.viteProxyNew);
  story.bash("12-noah-test", 1500, "noah", "npm test", "Run unit tests", s.noahPassedTestOutput, true);
  proxy("T11-noah-proxy.done", 500);
  story.stop(
    "13-noah-stop",
    600,
    "noah",
    'Added `db/schema/users.ts` (in-memory users table, seeded demo@shop.dev). I first tried `cors({ origin: "*", credentials: true })` in src/server.ts, but `npm test` failed: browsers reject `Access-Control-Allow-Origin: *` when credentials are allowed. I reverted it and added a Vite `/api` proxy in web/vite.config.ts instead, so the storefront calls the API same-origin. Unit tests pass.',
  );
}

/** Ash's first prompt: two tasks of routine reads (files nobody else touches). */
export function ashFirstPrompt(story: Story) {
  const pages = story.task("T06-ash-pages", 800, "ash", "Build pages", "Product list, cart and checkout pages");
  story.read("06a-ash-read-index", 900, "ash", "web/index.html");
  story.read("06b-ash-read-package", 1500, "ash", "package.json");
  pages("T06-ash-pages.done", 1800);
  const client = story.task("T06-ash-client", 600, "ash", "API client", "fetch wrapper for /api calls");
  story.read("06c-ash-read-readme", 1400, "ash", "README.md");
  client("T06-ash-client.done", 1600);
}

/**
 * Duplicate beats: Joshua's agent plans its own users table (Noah's) and its own Stripe webhook (Maya's); both
 * are denied, so it imports Noah's User and leaves payment confirmation to Maya.
 */
export function joshuaUntilSession(story: Story) {
  story.after("joshua", "07-noah-users.post", 600);
  story.task("T14-joshua-users", 0, "joshua", "Create users table", "Customers table for checkout");
  story.read("14a-joshua-read-flow", 500, "joshua", "test/integration/checkout-flow.test.ts");
  story.write("14-joshua-users", 900, "joshua", "db/schema/users.ts", s.joshuaUsersTable, true);
  const cart = story.task("T15-joshua-cart", 800, "joshua", "Cart model", "Cart keyed by the shared User");
  story.read("15a-joshua-read-products", 700, "joshua", "db/schema/products.ts");
  story.edit(
    "15-joshua-cart",
    1500,
    "joshua",
    "src/checkout/cart.ts",
    s.shop("src/checkout/cart.ts"),
    s.solution("src/checkout/cart.ts"),
  );
  cart("T15-joshua-cart.done", 600);
  // Duplicate beat 2: checkout writes its own Stripe webhook at the path Maya's agent just created.
  story.after("joshua", "M05-maya-webhook.post", 800);
  story.task("T32-joshua-webhook", 0, "joshua", "Stripe webhook", "Mark the order paid when Stripe calls back");
  story.write("32-joshua-webhook", 600, "joshua", "src/payments/stripe-webhook.ts", team.joshuaWebhook, true);
  // Conflict beat, part 1: checkout reads a session cookie while auth has not chosen a mechanism yet.
  const session = story.task("T19-joshua-session", 900, "joshua", "Session handling", "Identify the shopper");
  story.write("19-joshua-session", 1500, "joshua", "src/checkout/session.ts", s.joshuaCookieSession);
  session("T19-joshua-session.done", 600);
}

/** Stale beat: Ash's agent sets out to add the CORS middleware Noah's agent proved fails. */
export function ashCors(story: Story) {
  story.after("ash", "13-noah-stop", 3500);
  story.prompt("16-ash-cors-prompt", 0, "ash", "add CORS middleware to the API so the storefront can call it");
  story.task("T17-ash-cors", 1500, "ash", "CORS middleware", "cors() on the Express app");
  story.edit("17-ash-cors", 900, "ash", "src/server.ts", s.shop("src/server.ts"), s.serverWithCors, true);
  const proxy = story.task("T18-ash-proxy", 700, "ash", "Use the Vite proxy", "Route /api through the dev server");
  story.edit("18-ash-proxy", 1200, "ash", "web/vite.config.ts", s.viteProxyOld, s.viteProxyNew);
  proxy("T18-ash-proxy.done", 600);
  story.stop("27-ash-stop", 900, "ash", "Storefront calls the API through the Vite `/api` proxy; no CORS middleware needed.");
}

/** Conflict beat, part 2: auth moves to JWT bearer; Joshua's next cookie-based step is denied; Noah decides. */
export function conflict(story: Story) {
  story.after("noah", "19-joshua-session.post", 1000);
  story.prompt("20-noah-prompt", 0, "noah", "finish login: issue tokens and protect /api/me");
  const jwt = story.task("T21-noah-jwt", 600, "noah", "Issue JWT tokens", "jwt.sign on login");
  story.edit(
    "21-noah-jwt",
    1200,
    "noah",
    "src/auth/issue-token.ts",
    s.shop("src/auth/issue-token.ts"),
    s.solution("src/auth/issue-token.ts"),
  );
  jwt("T21-noah-jwt.done", 1500);
  // 8 s from 21.post to 22.pre, so the async judge has its verdict before Joshua's next edit.
  story.after("joshua", "21-noah-jwt.post", 7300);
  story.task("T22-joshua-routes", 0, "joshua", "Checkout routes", "GET /cart and POST /checkout");
  story.edit(
    "22-joshua-routes-cookie",
    600,
    "joshua",
    "src/checkout/routes.ts",
    s.joshuaRoutesCookieOld,
    s.joshuaRoutesCookieNew,
    true,
  );
  story.after("noah", "22-joshua-routes-cookie.pre", 2000);
  story.mcp("23-noah-decision", 0, "noah", "post_decision", {
    topic: "auth.mechanism",
    value: "jwt-bearer",
    rationale:
      "Stateless JWT in `Authorization: Bearer`; no session store. Checkout must use requireUser/currentUser from src/auth/require-user.ts.",
  });
  story.stop("28-noah-stop", 1500, "noah", "Login issues a JWT (`jwt.sign({ userId })`); `/api/me` is protected by `requireUser`.");
}

/** Joshua rebuilds on JWT once Noah decides. */
export function joshuaAfterDecision(story: Story) {
  story.after("joshua", "23-noah-decision", 1000);
  const onJwt = story.task("T24-joshua-session-jwt", 0, "joshua", "Session on JWT", "Reuse auth's requireUser");
  story.edit(
    "24-joshua-session-fix",
    1400,
    "joshua",
    "src/checkout/session.ts",
    s.joshuaCookieSession,
    s.joshuaSessionFixed,
  );
  onJwt("T24-joshua-session-jwt.done", 500);
  const routes = story.task("T25-joshua-routes", 500, "joshua", "Checkout routes", "requireUser + cart");
  story.edit(
    "25-joshua-routes",
    1200,
    "joshua",
    "src/checkout/routes.ts",
    s.shop("src/checkout/routes.ts"),
    s.solution("src/checkout/routes.ts"),
  );
  routes("T25-joshua-routes.done", 600);
  story.stop(
    "26-joshua-stop",
    1500,
    "joshua",
    "Checkout backend done: cart keyed by `User`, `POST /api/checkout` behind auth's `requireUser` (JWT bearer, per Noah's decision on auth.mechanism). Payment confirmation uses Maya's `handleStripeWebhook` in src/payments/stripe-webhook.ts.",
  );
}
