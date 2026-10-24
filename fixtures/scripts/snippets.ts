import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const demo = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../demo/${path}`, import.meta.url)), "utf8");

/** Files on `main` of lb-demo-shop; every agent's worktree starts from these. */
export const shop = (path: string) => demo(`shop/${path}`);
/** The reference solution: what the agents' finished, consistent work looks like. */
export const solution = (path: string) => demo(`solution/${path}`);

export const corsImport = 'import cors from "cors";\nimport express from "express";';
export const corsUse = 'app.use(cors({ origin: "*", credentials: true }));\napp.use(express.json());';

/** Noah's (and later Ash's) failed attempt: wildcard origin plus credentials. */
export const serverWithCors = shop("src/server.ts")
  .replace('import express from "express";', corsImport)
  .replace("app.use(express.json());", corsUse);

export const viteProxyOld = "  server: { port: 5173 },";
export const viteProxyNew =
  '  // Same-origin /api in the browser: no CORS, and credentials just work.\n  server: { port: 5173, proxy: { "/api": "http://localhost:3001" } },';

/** Joshua's checkout agent planning its own users table (denied: db.users belongs to Noah). */
export const joshuaUsersTable = `import { randomUUID } from "node:crypto";

export interface Customer {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

/** Customers who reach checkout; keyed by id. */
export const users = new Map<string, Customer>();

export function upsertCustomer(email: string, displayName: string): Customer {
  const existing = [...users.values()].find((c) => c.email === email);
  if (existing) return existing;
  const customer = { id: randomUUID(), email, displayName, createdAt: new Date() };
  users.set(customer.id, customer);
  return customer;
}
`;

/** Joshua's checkout identifies the shopper from a session cookie: the auth.mechanism conflict. */
export const joshuaCookieSession = `import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    session?: { userId?: string };
  }
}

/** Checkout trusts the session cookie set at login. */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "sign in required" });
    return;
  }
  res.locals.userId = userId;
  next();
}

export function sessionUserId(res: Response): string {
  return String(res.locals.userId);
}
`;

/** After Noah's decision (auth.mechanism = jwt-bearer) checkout reuses auth's middleware. */
export const joshuaSessionFixed = `// auth.mechanism is jwt-bearer (decided by noah): reuse auth's middleware, never read a session cookie.
export { currentUser, requireUser } from "../auth/require-user";
`;

/** Joshua's next cookie-based step, denied while the auth.mechanism conflict is open. */
export const joshuaRoutesCookieOld = `checkoutRouter.get("/cart", (_req, res) => {
  res.status(501).json({ error: "cart not implemented" });
});`;
export const joshuaRoutesCookieNew = `checkoutRouter.get("/cart", requireSession, (_req, res) => {
  res.json(getCartFor(sessionUserId(res)));
});`;

export const noahFailedTestOutput = `
> lb-demo-shop@0.1.0 test
> vitest run test/unit


 RUN  v3.2.7 /tmp/lb-demo/noah

 ❯ test/unit/storefront-access.test.ts (1 test | 1 failed) 13ms
   × storefront can reach the API from the browser > via the Vite /api proxy or a credential-safe CORS policy 12ms
     → browsers reject Access-Control-Allow-Origin: * when credentials are allowed: expected '*' not to be '*' // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/unit/storefront-access.test.ts > storefront can reach the API from the browser > via the Vite /api proxy or a credential-safe CORS policy
AssertionError: browsers reject Access-Control-Allow-Origin: * when credentials are allowed: expected '*' not to be '*' // Object.is equality
 ❯ test/unit/storefront-access.test.ts:22:110

 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  09:41:16
   Duration  537ms (transform 40ms, setup 0ms, collect 186ms, tests 13ms, environment 0ms, prepare 45ms)
`;

export const noahPassedTestOutput = `
> lb-demo-shop@0.1.0 test
> vitest run test/unit


 RUN  v3.2.7 /tmp/lb-demo/noah

 ✓ test/unit/storefront-access.test.ts (1 test) 1ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  09:44:02
   Duration  528ms (transform 46ms, setup 0ms, collect 198ms, tests 1ms, environment 0ms, prepare 45ms)
`;
