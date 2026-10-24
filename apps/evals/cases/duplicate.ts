import type { EvalCase } from "../src/case";

// Two agents build the same thing on separate branches. Neither can see the other's files, so only
// Little Brother can tell the second one the work already exists.

export const dupUsersTable: EvalCase = {
  id: "dup-users-table",
  title: "Auth and checkout both create the users table",
  why: "R2 same-create plus topic ownership: the second creator of db/schema/users.ts should be told to reuse it.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Create db/schema/users.ts: an in-memory users Map like db/schema/products.ts, seeded with the demo user (id u_demo, email demo@shop.dev, name Demo, password correct-horse stored as a sha256 hex hash via node:crypto), plus findUserByEmail(email) and verifyPassword(user, password). Use the User type from src/contracts/user.ts.",
        natural:
          "We need a users table with our demo account (demo@shop.dev / correct-horse) so login can work. Store passwords hashed, and add helpers to look a user up by email and to check a password.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Checkout needs to look up customers. Create db/schema/users.ts with an in-memory Map of users seeded with demo@shop.dev and a findUserByEmail(email) helper, using the User type from src/contracts/user.ts.",
        natural:
          "Checkout needs a way to look up customers by email. Add a customer store seeded with the demo account demo@shop.dev and a lookup-by-email helper next to the other db tables.",
      },
    },
  ],
  expect: [
    { agents: ["noah", "joshua"], type: "duplicate", evidence: ["joshua-users", "two-lookups", "merge"] },
  ],
  checks: [
    { id: "joshua-users", kind: "touched", agent: "joshua", file: "db/schema/users.ts" },
    {
      id: "two-lookups",
      kind: "grep",
      pattern: "(function|const|let)\\s+find\\w*ByEmail\\b",
      paths: ["db", "src"],
      on: "merged",
      minFiles: 2,
    },
    { id: "merge", kind: "mergeConflict", agents: ["noah", "joshua"] },
  ],
  success: {
    intact: [
      { id: "lookup", pattern: "[Bb]y_?[Ee]mail", paths: ["db", "src"] },
      { id: "password", pattern: "(function|const)\\s+\\w*[Pp]assword", paths: ["db", "src"] },
    ],
  },
};

export const dupOrderModel: EvalCase = {
  id: "dup-order-model",
  title: "Payments and checkout both define Order",
  why: "Two creates of src/contracts/order.ts and db/schema/orders.ts from different workstreams.",
  agents: [
    {
      handle: "maya",
      prompt: {
        pointed:
          "Add the order model: export interface Order { id: string; userId: string; items: CartItem[]; totalCents: number; createdAt: string } in src/contracts/order.ts (CartItem from src/checkout/cart.ts), and an in-memory orders Map with createOrder(order) in db/schema/orders.ts.",
        natural:
          "Add an order model for the shop: an Order type (id, user, items, total in cents, created time) and an in-memory orders table with a function to save a new order. Put them where the other contracts and tables live.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "maya", event: "firstEdit" } },
      prompt: {
        pointed:
          "Implement POST /api/checkout in src/checkout/routes.ts so it saves an order. Define the Order type in src/contracts/order.ts and an in-memory orders table in db/schema/orders.ts for it. Auth isn't done: use userId 'anonymous' and an empty item list for now.",
        natural:
          "Make checkout actually save an order. It needs an order type and somewhere to store orders. Auth isn't done yet, so use 'anonymous' as the user for now.",
      },
    },
  ],
  expect: [
    {
      agents: ["maya", "joshua"],
      type: "duplicate",
      evidence: ["joshua-contract", "joshua-table", "two-types", "merge"],
    },
  ],
  checks: [
    { id: "joshua-contract", kind: "touched", agent: "joshua", file: "src/contracts/order.ts" },
    { id: "joshua-table", kind: "touched", agent: "joshua", file: "db/schema/orders.ts" },
    {
      id: "two-types",
      kind: "grep",
      pattern: "(interface\\s+Order\\b|type\\s+Order\\s*=)",
      paths: ["src", "db"],
      on: "merged",
      minFiles: 2,
    },
    { id: "merge", kind: "mergeConflict", agents: ["maya", "joshua"] },
  ],
  success: {
    intact: [
      { id: "order-type", pattern: "(interface|type)\\s+Order\\b", paths: ["src/contracts/order.ts"] },
      {
        id: "save-order",
        pattern: "(function|const)\\s+\\w*([Ss]ave|[Cc]reate|[Aa]dd|[Ii]nsert)",
        paths: ["db/schema/orders.ts"],
      },
      { id: "checkout-saves", pattern: "[Oo]rder", paths: ["src/checkout/routes.ts"] },
    ],
  },
};

export const dupOrderEmail: EvalCase = {
  id: "dup-order-email",
  title: "Notifications and payments both write the receipt email",
  why: "Same helper written from two sides; the natural variant tests intent similarity, not just paths.",
  agents: [
    {
      handle: "priya",
      prompt: {
        pointed:
          "Create src/notify/order-email.ts exporting sendOrderConfirmation(to: string, orderId: string, totalCents: number) that builds a short HTML receipt and sends it with sendMail from src/notify/mailer.ts. Add test/unit/order-email.test.ts that mocks sendMail.",
        natural:
          "Customers should get a confirmation email after they order. Write a function that builds a short HTML receipt (order id and total) and sends it through our mailer, with a unit test.",
      },
    },
    {
      handle: "maya",
      start: { after: { agent: "priya", event: "firstEdit" } },
      prompt: {
        pointed:
          "After a payment succeeds we must email a receipt. Create src/notify/order-email.ts with sendOrderConfirmation(to, orderId, totalCents) using sendMail from src/notify/mailer.ts, and call it from a new handlePaymentSucceeded(orderId, email, totalCents) in src/payments/webhook.ts.",
        natural:
          "When a payment succeeds, email the customer a receipt with the order id and total. Add a payment-succeeded handler in the payments code that sends it through our mailer.",
      },
    },
  ],
  expect: [
    { agents: ["priya", "maya"], type: "duplicate", evidence: ["maya-email", "two-senders", "merge"] },
  ],
  checks: [
    { id: "maya-email", kind: "touched", agent: "maya", file: "src/notify/order-email.ts" },
    {
      id: "two-senders",
      kind: "grep",
      pattern: "(function|const)\\s+\\w*(Receipt|Confirmation)\\w*\\s*[=(]",
      paths: ["src"],
      on: "merged",
      minFiles: 2,
    },
    { id: "merge", kind: "mergeConflict", agents: ["priya", "maya"] },
  ],
  success: {
    intact: [
      { id: "sender", pattern: "(function|const)\\s+\\w*([Cc]onfirmation|[Rr]eceipt)", paths: ["src"] },
      { id: "webhook", pattern: "[Ss]ucceed", paths: ["src/payments"] },
    ],
  },
};
