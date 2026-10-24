/**
 * The three teammates added for the six-agent demo: maya on payments, leo on search, priya on notifications.
 * Their catches: Joshua duplicating Maya's webhook (story-trio), Priya's order email needing Maya's Order type
 * first (ordering), and Leo repeating the DOM test setup that failed for Priya (stale).
 */
import type { Story } from "./events";
import * as t from "./snippets-team";

/** Maya: the Order type, an orders table and the Stripe webhook, with a passing test. */
export function maya(story: Story) {
  const order = story.task("MT1-maya-order", 700, "maya", "Order type", "Shared Order contract for checkout and emails");
  story.read("M01-maya-read-products", 800, "maya", "db/schema/products.ts");
  story.write("M02-maya-order-type", 1500, "maya", "src/contracts/order.ts", t.mayaOrderType);
  order("MT1-maya-order.done", 500);
  const table = story.task("MT2-maya-orders", 600, "maya", "Orders table", "In-memory orders with markPaid");
  story.write("M03-maya-orders-table", 1600, "maya", "db/schema/orders.ts", t.mayaOrdersTable);
  table("MT2-maya-orders.done", 500);
  const hook = story.task("MT3-maya-webhook", 700, "maya", "Stripe webhook", "Verify the signature, mark the order paid");
  story.read("M04-maya-read-stripe", 700, "maya", "src/payments/stripe-client.ts");
  story.write("M05-maya-webhook", 1800, "maya", "src/payments/stripe-webhook.ts", t.mayaWebhook);
  hook("MT3-maya-webhook.done", 500);
}

/**
 * Maya's test comes after Joshua's denied duplicate: a test referencing stripe-webhook.ts next to Joshua's
 * live create of the same path would add an ordering note to the beat.
 */
export function mayaTest(story: Story) {
  story.after("maya", "32-joshua-webhook.pre", 1000);
  const test = story.task("MT4-maya-test", 0, "maya", "Webhook test", "Signed and unsigned events");
  story.write("M06-maya-webhook-test", 1500, "maya", "test/unit/stripe-webhook.test.ts", t.mayaWebhookTest);
  story.bash("M07-maya-test", 1200, "maya", "npm test", "Run unit tests", t.mayaTestOutput, true);
  test("MT4-maya-test.done", 500);
  story.stop(
    "M08-maya-stop",
    800,
    "maya",
    "Added `Order` in src/contracts/order.ts, an orders table with `markPaid`, and `handleStripeWebhook` in src/payments/stripe-webhook.ts (HMAC-verified). Tests pass.",
  );
}

/** Priya, first prompt: mailer, then a global jsdom test env that fails, then rendering without a DOM. */
export function priyaFirstPrompt(story: Story) {
  const mailer = story.task("PT1-priya-mailer", 800, "priya", "Mailer transport", "Dev outbox behind sendMail");
  story.read("P01-priya-read-mailer", 700, "priya", "src/notify/mailer.ts");
  story.edit("P02-priya-mailer", 1500, "priya", "src/notify/mailer.ts", t.priyaMailerOld, t.priyaMailerNew);
  mailer("PT1-priya-mailer.done", 500);
  story.task("PT2-priya-dom", 600, "priya", "DOM test environment", "Render email components in tests");
  story.read("P03-priya-read-vitest", 600, "priya", "vitest.config.ts");
  story.edit("P04-priya-jsdom", 1200, "priya", "vitest.config.ts", t.jsdomOld, t.jsdomNew);
  story.bash("P05-priya-test", 1300, "priya", "npm test", "Run unit tests", t.jsdomFailedOutput, false);
  story.edit("P06-priya-revert-jsdom", 2200, "priya", "vitest.config.ts", t.jsdomNew, t.jsdomOld);
  // The DOM task's last test failed and the agent moves on: it ends abandoned, and Stop distills the lesson.
  const render = story.task("PT3-priya-render", 700, "priya", "Render without a DOM", "renderToStaticMarkup");
  story.write("P07-priya-render", 1500, "priya", "src/notify/render.ts", t.priyaRender);
  story.write("P08-priya-render-test", 1300, "priya", "test/unit/render.test.ts", t.priyaRenderTest);
  story.bash(
    "P09-priya-test",
    1200,
    "priya",
    "npm test",
    "Run unit tests",
    t.passedUnitOutput(["test/unit/render.test.ts"]),
    true,
  );
  render("PT3-priya-render.done", 500);
  story.stop(
    "P10-priya-stop",
    700,
    "priya",
    'Mailer collects into an outbox. I tried `environment: "jsdom"` in vitest.config.ts, but `npm test` failed: jsdom is not installed. Emails now render with `renderToStaticMarkup` in the node environment instead.',
  );
}

/** Priya, second prompt: the order email references Maya's Order before it lands, so it waits. */
export function priyaOrders(story: Story) {
  story.after("priya", "M02-maya-order-type.post", 2000);
  story.prompt("P11-priya-prompt", 1500, "priya", "send an order confirmation email when an order is paid");
  story.task("PT4-priya-order-email", 700, "priya", "Order confirmation email", "Email the receipt when paid");
  story.write("P12-priya-order-email", 1500, "priya", "src/notify/order-email.ts", t.priyaOrderEmail, true);
  const ship = story.task("PT5-priya-shipping", 800, "priya", "Shipping notice", "Email when the order ships");
  story.write("P13-priya-shipping-email", 1500, "priya", "src/notify/shipping-email.ts", t.priyaShippingEmail);
  ship("PT5-priya-shipping.done", 500);
  story.stop(
    "P14-priya-stop",
    800,
    "priya",
    "Shipping notice is in. The order confirmation waits for Maya's `Order` type (src/contracts/order.ts) to land.",
  );
}

/** Leo: search function and endpoint, then the DOM test setup Priya's agent proved fails. */
export function leo(story: Story) {
  const fn = story.task("LT1-leo-search", 700, "leo", "Search function", "Case-insensitive name match");
  story.read("L01-leo-read-products", 700, "leo", "db/schema/products.ts");
  story.write("L02-leo-search", 1600, "leo", "src/catalog/search.ts", t.leoSearch);
  fn("LT1-leo-search.done", 500);
  const route = story.task("LT2-leo-endpoint", 600, "leo", "Search endpoint", "GET /api/search?q=");
  story.read("L03-leo-read-routes", 600, "leo", "src/catalog/routes.ts");
  story.edit("L04-leo-route-import", 1300, "leo", "src/catalog/routes.ts", t.leoRoutesOld, t.leoRoutesNew);
  story.edit("L05-leo-route", 900, "leo", "src/catalog/routes.ts", t.leoRouteOld, t.leoRouteNew);
  route("LT2-leo-endpoint.done", 500);
  // Stale beat 2: the same global jsdom switch, after Priya's lesson exists.
  story.after("leo", "P10-priya-stop", 3000);
  story.task("LT3-leo-dom", 0, "leo", "Search box test setup", "DOM environment for the search box test");
  story.edit("L06-leo-jsdom", 900, "leo", "vitest.config.ts", t.jsdomOld, t.jsdomNew, true);
  const test = story.task("LT4-leo-test", 700, "leo", "Test search without DOM", "Unit test searchProducts");
  story.write("L07-leo-search-test", 1500, "leo", "test/unit/search.test.ts", t.leoSearchTest);
  story.bash(
    "L08-leo-test",
    1200,
    "leo",
    "npm test",
    "Run unit tests",
    t.passedUnitOutput(["test/unit/search.test.ts"]),
    true,
  );
  test("LT4-leo-test.done", 500);
  story.stop(
    "L09-leo-stop",
    800,
    "leo",
    "`GET /api/search?q=` uses `searchProducts` (src/catalog/search.ts). Tests stay in the node environment, per Priya's lesson on jsdom.",
  );
}
