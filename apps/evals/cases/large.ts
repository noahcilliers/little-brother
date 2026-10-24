import type { EvalCase } from "../src/case";

// Larger clashes, where the duplicated or failed work is a whole module with tests or a debug loop over
// several test runs. A catch can only pay for its own interruption when the work it spares is big, so these
// are where measured savings should show up if they exist at all.

const UNIT = "npx vitest run test/unit --exclude test/unit/storefront-access.test.ts --passWithNoTests";

export const largeDupRateLimit: EvalCase = {
  id: "large-dup-rate-limit",
  title: "Auth and checkout both build a rate-limiting module with tests",
  why: "A full middleware module plus a test file, written twice from two workstreams.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Build a reusable rate limiter in src/middleware/rate-limit.ts: export rateLimit({ windowMs, max, key }) returning Express middleware with a fixed-window in-memory counter per key (default key: req.ip) that answers 429 with { error: 'rate limited', retryAfterSec } and sets the Retry-After header once a key exceeds max in its window, plus resetRateLimits() for tests. Apply it to POST /api/auth/login in src/auth/routes.ts (5 per minute). Write thorough tests in test/unit/rate-limit.test.ts with supertest and fake timers: under the limit, at the limit, window reset, separate keys, the header. Run npm test until they pass.",
        natural:
          "Login needs brute-force protection. Build a reusable fixed-window rate limiter middleware for the API (429 with a Retry-After header when exceeded, a way to reset it in tests), apply it to login at 5 attempts per minute, and cover it with thorough unit tests using fake timers. Get the tests passing.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Checkout is getting hammered. Build a reusable rate limiter in src/middleware/rate-limit.ts: export rateLimit({ windowMs, max, key }) returning Express middleware with an in-memory fixed-window counter per key (default req.ip) that answers 429 with a Retry-After header when exceeded, plus resetRateLimits() for tests. Apply it to POST /api/checkout in src/checkout/routes.ts (10 per minute). Write tests in test/unit/rate-limit.test.ts with supertest and fake timers covering the limit, window reset and separate keys. Run npm test until they pass.",
        natural:
          "Checkout is getting hammered by bots. Add a reusable fixed-window rate limiter middleware to the API (429 plus Retry-After when exceeded, resettable in tests), use it on checkout at 10 requests per minute, and write unit tests with fake timers. Get the tests passing.",
      },
    },
  ],
  expect: [{ agents: ["noah", "joshua"], type: "duplicate", evidence: ["joshua-module", "two-limiters"] }],
  checks: [
    { id: "joshua-module", kind: "touched", agent: "joshua", file: "src/middleware/rate-limit.ts" },
    {
      id: "two-limiters",
      kind: "grep",
      pattern: "(function|const)\\s+rateLimit\\b",
      paths: ["src"],
      on: "noah",
      minFiles: 1,
    },
  ],
  success: {
    run: ["npm run typecheck", UNIT],
    intact: [
      { id: "limiter", pattern: "rateLimit", paths: ["src/middleware"] },
      { id: "on-login", pattern: "rateLimit", paths: ["src/auth/routes.ts"] },
      { id: "on-checkout", pattern: "rateLimit", paths: ["src/checkout/routes.ts"] },
    ],
  },
};

export const largeDupPricing: EvalCase = {
  id: "large-dup-pricing",
  title: "Checkout and payments both build the order pricing engine",
  why: "A pricing module with rounding-sensitive rules and its tests: a debug loop over several test runs, done twice.",
  agents: [
    {
      handle: "joshua",
      prompt: {
        pointed:
          "Create src/checkout/pricing.ts exporting priceCart(items: CartItem[], opts: { coupon?: string; region: 'CA' | 'NY' | 'TX' }): { subtotalCents, discountCents, taxCents, shippingCents, totalCents }. Prices come from db/schema/products.ts. Coupons: SAVE10 = 10% off the subtotal, FLAT5 = 500 cents off orders of at least 2000 cents, unknown coupons throw. Tax on (subtotal - discount): CA 7.25%, NY 8.875%, TX 6.25%, rounded half-up to the cent. Shipping 499 cents, free from 5000 cents after discount. Unknown products throw. Write test/unit/pricing.test.ts with at least 12 cases including the rounding edges, and run npm test until everything passes.",
        natural:
          "We need an order pricing engine for checkout: subtotal from the product table, coupons (SAVE10 is 10% off; FLAT5 is $5 off orders of $20 or more; unknown coupons are an error), sales tax by region (CA 7.25%, NY 8.875%, TX 6.25%, rounded half-up to the cent, on the discounted subtotal) and shipping ($4.99, free from $50 after discount). Cover it with a thorough unit test suite including rounding edge cases and get it passing.",
      },
    },
    {
      handle: "maya",
      start: { after: { agent: "joshua", event: "firstEdit" } },
      prompt: {
        pointed:
          "Payments needs the charge amount. Create src/checkout/pricing.ts exporting priceCart(items: CartItem[], opts: { coupon?: string; region: 'CA' | 'NY' | 'TX' }) returning subtotal, discount, tax, shipping and total in cents. Product prices from db/schema/products.ts; coupons SAVE10 (10% off) and FLAT5 (500 off orders of at least 2000); tax CA 7.25%, NY 8.875%, TX 6.25% on the discounted subtotal, half-up to the cent; shipping 499, free from 5000 after discount. Then add chargeAmountCents(items, opts) in src/payments/stripe-client.ts using it. Write test/unit/pricing.test.ts with the rounding edges and run npm test until it passes.",
        natural:
          "Payments needs to know how much to charge. Build the order pricing (product subtotal, SAVE10 and FLAT5 coupons, regional sales tax for CA/NY/TX rounded half-up, $4.99 shipping that's free from $50) and a helper in the payments client that returns the amount to charge. Test the pricing thoroughly, rounding included, and get the tests passing.",
      },
    },
  ],
  expect: [{ agents: ["joshua", "maya"], type: "duplicate", evidence: ["maya-pricing", "two-engines"] }],
  checks: [
    { id: "maya-pricing", kind: "touched", agent: "maya", file: "src/checkout/pricing.ts" },
    {
      id: "two-engines",
      kind: "grep",
      pattern: "(function|const)\\s+priceCart\\b",
      paths: ["src"],
      on: "joshua",
      minFiles: 1,
    },
  ],
  success: {
    run: ["npm run typecheck", UNIT],
    intact: [
      { id: "engine", pattern: "priceCart", paths: ["src/checkout"] },
      { id: "charge", pattern: "chargeAmountCents", paths: ["src/payments"] },
    ],
  },
};

export const largeStaleComponentTests: EvalCase = {
  id: "large-stale-component-tests",
  title: "React component tests without a DOM library, tried again",
  why: "A long failed attempt (config, several test files, repeated runs) that a later session is asked to repeat.",
  agents: [
    {
      handle: "priya",
      endsSession: true,
      prompt: {
        pointed:
          "Set up React component tests for the storefront without installing anything: switch vitest.config.ts to environment 'jsdom', include web/**/*.test.tsx, and write web/src/App.test.tsx rendering <App /> with react-dom/client and asserting the Products heading and the empty-cart text. Run npm test and try to make it work with what's installed. If after a few attempts it still can't run, revert everything with `git checkout . && git clean -fd web` and stop.",
        natural:
          "Get React component tests running for the storefront with the packages we already have (don't install anything): configure vitest for a DOM, write a test that renders the App and checks the products heading and the empty cart message. If you can't get it running after a few attempts, undo all of it and stop.",
      },
    },
    {
      handle: "ash",
      start: { after: { agent: "priya", event: "done" }, delaySec: 10 },
      prompt: {
        pointed:
          "Add React component tests for the storefront: configure vitest.config.ts with environment 'jsdom' and include web/**/*.test.tsx, then write web/src/App.test.tsx that renders <App /> and checks the Products heading and the empty-cart text. Don't install packages. Run npm test until it passes.",
        natural:
          "Add component tests for the storefront App (products heading, empty cart message) using what's already installed, and get npm test passing.",
      },
    },
  ],
  expect: [
    {
      agents: ["ash", "priya"],
      type: "stale",
      relation: "repeats_failure",
      evidence: ["ash-jsdom", "ash-test"],
    },
  ],
  checks: [
    {
      id: "ash-jsdom",
      kind: "grep",
      pattern: "environment:\\s*[\"'`]jsdom",
      paths: ["vitest.config.ts"],
      on: "ash",
      minFiles: 1,
    },
    { id: "ash-test", kind: "touched", agent: "ash", file: "web/src/App.test.tsx" },
  ],
  success: { run: ["npm run typecheck", UNIT] },
};
