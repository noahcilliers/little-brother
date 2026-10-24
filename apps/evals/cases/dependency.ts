import type { EvalCase } from "../src/case";

// Clashes in code that merges cleanly but breaks: a changed signature or contract another agent relies on
// (semantic_conflict), or a symbol used before the agent creating it has landed (ordering_dependency).

export const semanticUserRename: EvalCase = {
  id: "semantic-user-rename",
  title: "Rename User.name while the storefront adds a new use of it",
  why: "R4/R5: a contract field is renamed on one branch and newly referenced on another; typecheck breaks only after merge.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Rename the User field `name` to `displayName` in src/contracts/user.ts and update every existing use in the repo (src/ and web/). Run npm run typecheck.",
        natural:
          "We're renaming the user's `name` to `displayName` in the API contract. Update the User type and everything that uses it, and keep typecheck green.",
      },
    },
    {
      handle: "ash",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Create web/src/Greeting.tsx exporting Greeting({ user }: { user: User }) that renders 'Welcome back, {user.name}!' (User from src/contracts/user.ts), and render it in web/src/App.tsx when signed in. Run npm run typecheck.",
        natural:
          "Greet signed-in customers with 'Welcome back, <their name>!' in a small new storefront component, shown when they're signed in.",
      },
    },
  ],
  expect: [
    {
      agents: ["noah", "ash"],
      type: "conflict",
      relation: "semantic_conflict",
      evidence: ["merged-typecheck"],
    },
  ],
  checks: [{ id: "merged-typecheck", kind: "commandFails", run: "npm run typecheck", on: "merged" }],
  success: {
    intact: [
      { id: "renamed", pattern: "displayName", paths: ["src/contracts/user.ts"] },
      { id: "greeting", pattern: "Welcome back", paths: ["web/src"] },
    ],
  },
};

export const semanticTokenSignature: EvalCase = {
  id: "semantic-token-signature",
  title: "issueToken gains a required argument while login calls the old one",
  why: "R5 signature change versus a caller written at the same time on another branch.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Change issueToken in src/auth/issue-token.ts to issueToken(user: User, opts: { expiresInSec: number }): string, implemented as a base64url JSON token {sub, exp}. opts is required. Run npm run typecheck.",
        natural:
          "Tokens must expire. Make the token issuer require an explicit expiry in seconds and encode it into the token; keep typecheck passing.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Implement POST /api/auth/login in src/auth/routes.ts: accept demo@shop.dev / correct-horse (hardcode the user { id: 'u_demo', email, name: 'Demo' }) and return { token: issueToken(user) } using issueToken from src/auth/issue-token.ts. Don't change issue-token.ts.",
        natural:
          "Implement the login endpoint: accept the demo account (demo@shop.dev / correct-horse, hardcoded for now) and return a token from our existing token issuer without changing the issuer.",
      },
    },
  ],
  expect: [
    {
      agents: ["noah", "joshua"],
      type: "conflict",
      relation: "semantic_conflict",
      evidence: ["merged-typecheck", "merge"],
    },
  ],
  checks: [
    { id: "merged-typecheck", kind: "commandFails", run: "npm run typecheck", on: "merged" },
    { id: "merge", kind: "mergeConflict", agents: ["noah", "joshua"] },
  ],
  success: {
    intact: [
      { id: "expiry", pattern: "[Ee]xpir", paths: ["src/auth/issue-token.ts"] },
      { id: "login", pattern: "login", paths: ["src/auth/routes.ts"] },
    ],
  },
};

export const orderingOrderType: EvalCase = {
  id: "ordering-order-type",
  title: "Order email imports the Order type before it lands",
  why: "R6 create-vs-reference: priya builds on a type maya is still creating, so maya must land first.",
  agents: [
    {
      handle: "maya",
      prompt: {
        pointed:
          "Create src/contracts/order.ts exporting interface Order { id: string; userId: string; email: string; items: { productId: string; quantity: number }[]; totalCents: number }. Only this file.",
        natural:
          "Define the shop's Order type in the contracts folder: id, userId, email, items and totalCents.",
      },
    },
    {
      handle: "priya",
      start: { after: { agent: "maya", event: "firstEdit" } },
      prompt: {
        pointed:
          "Maya is adding the Order type in src/contracts/order.ts on her branch. Write sendOrderConfirmation(order: Order) in src/notify/order-email.ts that emails order.email a receipt via sendMail, importing Order from ../contracts/order. Don't create the Order type yourself.",
        natural:
          "A teammate is adding the Order type to the contracts folder right now. Write an order-confirmation email function that takes an Order and sends a receipt to its email through our mailer. Import their Order type; don't define your own.",
      },
    },
  ],
  expect: [
    {
      agents: ["maya", "priya"],
      type: "conflict",
      relation: "ordering_dependency",
      evidence: ["priya-typecheck"],
    },
  ],
  checks: [{ id: "priya-typecheck", kind: "commandFails", run: "npm run typecheck", on: "priya" }],
};

export const orderingRequireAdmin: EvalCase = {
  id: "ordering-require-admin",
  title: "Admin-only route uses middleware that doesn't exist yet",
  why: "R6 on a function rather than a type, across the auth and catalog workstreams.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Create src/auth/require-admin.ts exporting requireAdmin(req, res, next): Express middleware that answers 403 unless res.locals.user?.email ends with '@shop.dev'. Only this file.",
        natural:
          "Add an admin-only middleware to the auth code: 403 unless the signed-in user's email is on the shop.dev domain.",
      },
    },
    {
      handle: "leo",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Add DELETE /api/products/:id in src/catalog/routes.ts that removes the product from the products Map, protected by requireAdmin imported from ../auth/require-admin. Noah is writing requireAdmin on his branch; don't write it yourself.",
        natural:
          "Add an endpoint to delete a product. It must be admin-only: use the requireAdmin middleware a teammate is adding to the auth code right now instead of writing your own.",
      },
    },
  ],
  expect: [
    {
      agents: ["noah", "leo"],
      type: "conflict",
      relation: "ordering_dependency",
      evidence: ["leo-typecheck"],
    },
  ],
  checks: [{ id: "leo-typecheck", kind: "commandFails", run: "npm run typecheck", on: "leo" }],
  success: {
    intact: [
      { id: "middleware", pattern: "[Aa]dmin", paths: ["src/auth"] },
      { id: "route", pattern: "\\.delete\\(", paths: ["src/catalog/routes.ts"] },
    ],
  },
};
