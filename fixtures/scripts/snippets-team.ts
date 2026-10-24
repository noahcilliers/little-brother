import { shop } from "./snippets";

/** Maya (payments): the Order type others build on. Priya's order email references it before it lands. */
export const mayaOrderType = `export type OrderStatus = "pending" | "paid" | "refunded";

/** One checkout's order. Payments marks it paid from the Stripe webhook; emails read it. */
export interface Order {
  id: string;
  userId: string;
  email: string;
  items: { productId: string; quantity: number }[];
  totalCents: number;
  status: OrderStatus;
}
`;

export const mayaOrdersTable = `import type { Order } from "../../src/contracts/order";

export const orders = new Map<string, Order>();

export function markPaid(orderId: string): Order | undefined {
  const order = orders.get(orderId);
  if (order) order.status = "paid";
  return order;
}
`;

export const mayaWebhook = `import { createHmac, timingSafeEqual } from "node:crypto";
import { markPaid } from "../../db/schema/orders";
import { stripeConfig } from "./stripe-client";

/** Stripe signs the raw body: \`t=<ts>,v1=<hmac>\`. */
export function verifyStripeSignature(rawBody: string, header: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", stripeConfig.webhookSecret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

/** checkout.session.completed → the order is paid. */
export function handleStripeWebhook(rawBody: string, signature: string): { ok: boolean; orderId?: string } {
  if (!verifyStripeSignature(rawBody, signature)) return { ok: false };
  const event = JSON.parse(rawBody) as { type: string; data: { object: { client_reference_id?: string } } };
  if (event.type !== "checkout.session.completed") return { ok: true };
  const orderId = event.data.object.client_reference_id;
  if (orderId) markPaid(orderId);
  return { ok: true, orderId };
}
`;

export const mayaWebhookTest = `import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handleStripeWebhook } from "../../src/payments/stripe-webhook";

const sign = (body: string) =>
  \`t=1,v1=\${createHmac("sha256", "whsec_demo").update(\`1.\${body}\`).digest("hex")}\`;

describe("stripe webhook", () => {
  it("rejects a bad signature and accepts a signed event", () => {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    expect(handleStripeWebhook(body, "t=1,v1=bad").ok).toBe(false);
    expect(handleStripeWebhook(body, sign(body)).ok).toBe(true);
  });
});
`;

export const mayaTestOutput = `
> lb-demo-shop@0.1.0 test
> vitest run test/unit

 ✓ test/unit/stripe-webhook.test.ts (1 test) 3ms
 ✓ test/unit/storefront-access.test.ts (1 test) 1ms

 Test Files  2 passed (2)
      Tests  2 passed (2)
`;

/** Joshua's checkout agent writing its own Stripe webhook: the duplicate of Maya's. */
export const joshuaWebhook = `import { checkoutRouter } from "../checkout/routes";

/** Stripe calls this when a checkout session is paid. */
checkoutRouter.post("/stripe/webhook", (req, res) => {
  const event = req.body as { type?: string };
  if (event.type === "checkout.session.completed") res.locals.paid = true;
  res.json({ received: true });
});
`;

/** Priya (notifications): an outbox mailer replaces the stub. */
export const priyaMailerOld = `export function sendMail(_mail: Mail): Promise<void> {
  return Promise.reject(new Error("mailer not configured"));
}`;
export const priyaMailerNew = `/** Dev outbox: mail is collected here; a real transport plugs in behind sendMail. */
export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  outbox.push(mail);
}`;

/** The failed approach Priya's agent tries first and Leo's agent later repeats: a global DOM test env. */
export const jsdomOld = 'environment: "node"';
export const jsdomNew = 'environment: "jsdom"';

export const jsdomFailedOutput = `
> lb-demo-shop@0.1.0 test
> vitest run test/unit

⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯
Error: Cannot find package 'jsdom' imported from node_modules/vitest/dist/chunks/index.js
 ❯ loadEnvironment node_modules/vitest/dist/chunks/index.js:2271:11

 Test Files  no tests
`;

export const priyaRender = `import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Emails render to static HTML on the server: no DOM, so tests run in the node environment. */
export function renderEmail(body: ReactElement): string {
  return \`<!doctype html>\${renderToStaticMarkup(createElement("html", null, createElement("body", null, body)))}\`;
}
`;

export const priyaRenderTest = `import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderEmail } from "../../src/notify/render";

describe("renderEmail", () => {
  it("renders static HTML without a DOM", () => {
    expect(renderEmail(createElement("p", null, "Thanks!"))).toContain("<p>Thanks!</p>");
  });
});
`;

export const passedUnitOutput = (files: string[]) => `
> lb-demo-shop@0.1.0 test
> vitest run test/unit

${files.map((f) => ` ✓ ${f} (1 test) 2ms`).join("\n")}

 Test Files  ${files.length} passed (${files.length})
      Tests  ${files.length} passed (${files.length})
`;

/** Priya's order email references Maya's Order before Maya's branch lands: the ordering dependency. */
export const priyaOrderEmail = `import { createElement } from "react";
import type { Order } from "../contracts/order";
import { sendMail } from "./mailer";
import { renderEmail } from "./render";

export function sendOrderConfirmation(order: Order): Promise<void> {
  const total = (order.totalCents / 100).toFixed(2);
  const html = renderEmail(createElement("p", null, \`Thanks! Order \${order.id} is paid: $\${total}.\`));
  return sendMail({ to: order.email, subject: \`Order \${order.id} confirmed\`, html });
}
`;

export const priyaShippingEmail = `import { createElement } from "react";
import { sendMail } from "./mailer";
import { renderEmail } from "./render";

export function sendShippingNotice(to: string, orderId: string, tracking: string): Promise<void> {
  const html = renderEmail(createElement("p", null, \`Order \${orderId} shipped. Tracking: \${tracking}.\`));
  return sendMail({ to, subject: \`Order \${orderId} shipped\`, html });
}
`;

/** Leo (search). */
export const leoSearch = `import { type Product, products } from "../../db/schema/products";

/** Case-insensitive match on the product name, best (prefix) matches first. */
export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = [...products.values()].filter((p) => p.name.toLowerCase().includes(q));
  return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)));
}
`;

const catalogRoutes = shop("src/catalog/routes.ts");
export const leoRoutesOld = 'import { products } from "../../db/schema/products";';
export const leoRoutesNew =
  'import { products } from "../../db/schema/products";\nimport { searchProducts } from "./search";';
export const leoRouteOld = catalogRoutes.slice(catalogRoutes.indexOf("catalogRouter.get")).trimEnd();
export const leoRouteNew = `${leoRouteOld}

catalogRouter.get("/search", (req, res) => {
  res.json(searchProducts(String(req.query.q ?? "")));
});`;

export const leoSearchTest = `import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/catalog/search";

describe("searchProducts", () => {
  it("matches names case-insensitively, prefix first", () => {
    expect(searchProducts("MUG").map((p) => p.id)).toEqual(["p_mug"]);
    expect(searchProducts("")).toEqual([]);
  });
});
`;
