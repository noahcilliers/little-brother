import type { EvalCase } from "../src/case";

// Work that looks related but doesn't clash. Any finding here is a false positive.

export const controlUnrelated: EvalCase = {
  id: "control-unrelated",
  title: "Search endpoint and mailer outbox",
  why: "Different topics, different files, same time.",
  agents: [
    {
      handle: "leo",
      prompt: {
        pointed:
          "Add GET /api/search?q= in src/catalog/routes.ts returning products whose name contains q, case-insensitive.",
        natural: "Add a product search endpoint that matches product names case-insensitively.",
      },
    },
    {
      handle: "priya",
      prompt: {
        pointed:
          "Implement sendMail in src/notify/mailer.ts so it appends each mail to an exported in-memory `outbox` array and resolves. Add test/unit/mailer.test.ts.",
        natural:
          "Replace the mailer stub with an in-memory outbox we can inspect in tests, and add a unit test for it.",
      },
    },
  ],
  expect: [],
  checks: [],
};

export const controlSameMechanism: EvalCase = {
  id: "control-same-mechanism",
  title: "Both sides agree on JWT bearer auth",
  why: "Same topic, same value: issuing tokens and requiring them are compatible halves of one design.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Implement issueToken in src/auth/issue-token.ts: sign { sub: user.id, email: user.email } with jsonwebtoken using process.env.JWT_SECRET ?? 'dev-secret', expiring in 1h. Only that file.",
        natural:
          "Implement JWT token issuing for logins: 1 hour expiry, secret from JWT_SECRET with a dev default.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Protect POST /api/checkout in src/checkout/routes.ts with requireUser from src/auth/require-user.ts. Auth uses JWT bearer tokens in the Authorization header, which requireUser handles. Only edit src/checkout/routes.ts.",
        natural:
          "Make checkout require a signed-in user with the existing requireUser middleware (auth is JWT bearer tokens). Only touch the checkout routes.",
      },
    },
  ],
  expect: [],
  checks: [],
};

export const controlNeighbours: EvalCase = {
  id: "control-neighbours",
  title: "Storefront copy and the cart API",
  why: "A consumer and a producer of the cart shape working at once without changing the shape.",
  agents: [
    {
      handle: "ash",
      prompt: {
        pointed:
          "In web/src/App.tsx change the Products heading to show the count, e.g. 'Products (3)', and show 'Your cart is empty' under Cart when there are no items. Only the storefront.",
        natural:
          "In the storefront, show how many products there are in the products heading, and an empty-cart message when the cart has no items.",
      },
    },
    {
      handle: "joshua",
      prompt: {
        pointed:
          "Implement the cart in src/checkout/routes.ts: GET /api/cart returns { items } from an in-memory cart, POST /api/cart/items adds { productId, quantity } and answers 201 with the cart. Use the types in src/checkout/cart.ts. No auth yet.",
        natural:
          "Implement an in-memory cart API: get the cart, and add items (answer 201 with the cart). No auth yet.",
      },
    },
  ],
  expect: [],
  checks: [],
};

export const controlConfigAndTests: EvalCase = {
  id: "control-config-and-tests",
  title: "Test timeout tweak and a new unit test",
  why: "Both touch the test setup, one in config and one in a new file; nothing overlaps.",
  agents: [
    {
      handle: "priya",
      prompt: {
        pointed:
          "In vitest.config.ts set test.testTimeout to 10000 and keep everything else as is. Run npm test.",
        natural: "Raise the test timeout to 10 seconds for the whole test suite.",
      },
    },
    {
      handle: "ash",
      start: { after: { agent: "priya", event: "firstEdit" } },
      prompt: {
        pointed:
          "Add test/unit/api-client.test.ts testing that api.products() in web/src/api.ts calls fetch('/api/products') (stub globalThis.fetch with vi.fn). Run npm test.",
        natural: "Add a unit test for the storefront API client's product listing, stubbing fetch.",
      },
    },
  ],
  expect: [],
  checks: [],
};
