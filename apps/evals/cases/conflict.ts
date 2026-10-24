import type { EvalCase } from "../src/case";

// Contradictory prompts: two agents are told to solve the same problem in incompatible ways.

export const conflictAuthMechanism: EvalCase = {
  id: "conflict-auth-mechanism",
  title: "JWT bearer vs session cookie",
  why: "The headline contradiction: same topic (auth), different value. Both rewrite src/auth/*.",
  agents: [
    {
      handle: "noah",
      prompt: {
        pointed:
          "Implement auth with JWT bearer tokens: issueToken in src/auth/issue-token.ts signs { sub: user.id } with jsonwebtoken (secret process.env.JWT_SECRET ?? 'dev-secret'), and requireUser in src/auth/require-user.ts reads 'Authorization: Bearer <token>', verifies it and sets res.locals.user. Don't use cookies.",
        natural:
          "Implement authentication for the API with stateless JWT bearer tokens in the Authorization header. No cookies or server-side sessions.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "noah", event: "firstEdit" } },
      prompt: {
        pointed:
          "Implement auth with server-side sessions: issueToken in src/auth/issue-token.ts creates a random session id stored in an in-memory Map, and requireUser in src/auth/require-user.ts reads it from an httpOnly 'sid' cookie (parse the Cookie header yourself). Don't use JWTs.",
        natural:
          "Implement authentication for the API with an httpOnly session cookie backed by an in-memory session store. Don't use JWTs: we need to be able to revoke sessions.",
      },
    },
  ],
  expect: [
    {
      agents: ["noah", "joshua"],
      type: "conflict",
      relation: "intent_contradiction",
      evidence: ["merge", "both"],
    },
  ],
  checks: [
    { id: "merge", kind: "mergeConflict", agents: ["noah", "joshua"] },
    {
      id: "noah-jwt",
      kind: "grep",
      pattern: "jsonwebtoken|jwt\\.(sign|verify)",
      paths: ["src/auth"],
      on: "noah",
      minFiles: 1,
    },
    {
      id: "joshua-cookie",
      kind: "grep",
      pattern: "sid|[Cc]ookie",
      paths: ["src/auth"],
      on: "joshua",
      minFiles: 1,
    },
    { id: "both", kind: "allOf", of: ["noah-jwt", "joshua-cookie"] },
  ],
};

export const conflictCorsVsProxy: EvalCase = {
  id: "conflict-cors-vs-proxy",
  title: "Fix storefront access with a proxy vs with CORS",
  why: "Different files (web/vite.config.ts vs src/server.ts) on one topic: only topic/intent reasoning can see it.",
  agents: [
    {
      handle: "ash",
      prompt: {
        pointed:
          "The storefront can't reach the API. Fix it on the frontend: add a Vite dev-server proxy in web/vite.config.ts forwarding /api to http://localhost:3001. The API must stay same-origin only, so don't add CORS to it. Run npm test.",
        natural:
          "The storefront can't reach the API in dev. Fix it with a dev proxy on the frontend so the browser stays same-origin; we don't want CORS on the API. Make npm test pass.",
      },
    },
    {
      handle: "noah",
      start: { after: { agent: "ash", event: "firstEdit" } },
      prompt: {
        pointed:
          "The storefront can't reach the API. Fix it on the API: add the cors middleware in src/server.ts allowing origin http://localhost:5173 with credentials: true. Don't touch the Vite config. Run npm test.",
        natural:
          "The storefront on :5173 can't call the API on :3001. Enable CORS on the API for the storefront origin, with credentials, and leave the frontend build config alone. Make npm test pass.",
      },
    },
  ],
  expect: [
    { agents: ["ash", "noah"], type: "conflict", relation: "intent_contradiction", evidence: ["both"] },
  ],
  checks: [
    {
      id: "ash-proxy",
      kind: "grep",
      pattern: "proxy",
      paths: ["web/vite.config.ts"],
      on: "ash",
      minFiles: 1,
    },
    { id: "noah-cors", kind: "grep", pattern: "cors\\(", paths: ["src"], on: "noah", minFiles: 1 },
    { id: "both", kind: "allOf", of: ["ash-proxy", "noah-cors"] },
  ],
};

export const conflictProductSort: EvalCase = {
  id: "conflict-product-sort",
  title: "Sort products by name vs by price",
  why: "Same handler, same lines, opposite behaviour: R1 line overlap should call it a conflict.",
  agents: [
    {
      handle: "leo",
      prompt: {
        pointed:
          "In src/catalog/routes.ts make GET /api/products return the products sorted by name, A to Z.",
        natural: "The product list from the API should be alphabetical by name.",
      },
    },
    {
      handle: "joshua",
      start: { after: { agent: "leo", event: "firstEdit" } },
      prompt: {
        pointed:
          "In src/catalog/routes.ts make GET /api/products return the products sorted by price, cheapest first.",
        natural: "The product list from the API should show the cheapest products first.",
      },
    },
  ],
  expect: [
    {
      agents: ["leo", "joshua"],
      type: "conflict",
      relation: "textual_conflict",
      evidence: ["merge", "both"],
    },
  ],
  checks: [
    { id: "merge", kind: "mergeConflict", agents: ["leo", "joshua"] },
    {
      id: "leo-name",
      kind: "grep",
      pattern: "localeCompare|\\.name\\s*[<>]",
      paths: ["src/catalog"],
      on: "leo",
      minFiles: 1,
    },
    {
      id: "joshua-price",
      kind: "grep",
      pattern: "priceCents\\s*-|priceCents\\s*[<>]",
      paths: ["src/catalog"],
      on: "joshua",
      minFiles: 1,
    },
    { id: "both", kind: "allOf", of: ["leo-name", "joshua-price"] },
  ],
};
