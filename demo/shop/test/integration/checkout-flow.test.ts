import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/server";

// The seeded demo user lives in db/schema/users.ts, which the auth workstream creates.
const DEMO_USER = { email: "demo@shop.dev", password: "correct-horse" };

/**
 * Agnostic about the auth mechanism on purpose: a cookie jar plus a bearer header when login
 * returns a token. It only passes when auth and checkout agree on one mechanism.
 */
async function signIn() {
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send(DEMO_USER);
  expect(login.status, "POST /api/auth/login").toBe(200);
  const token: unknown = login.body.token;
  const auth = typeof token === "string" ? { Authorization: `Bearer ${token}` } : {};
  return { agent, auth };
}

describe("storefront flow: sign in → cart → checkout", () => {
  it("rejects checkout without signing in", async () => {
    const res = await request(app).post("/api/checkout");
    expect(res.status).toBe(401);
  });

  it("signs in, fills the cart and checks out", async () => {
    const products = await request(app).get("/api/products");
    expect(products.status).toBe(200);
    const [mug] = products.body as { id: string; priceCents: number }[];
    expect(mug).toBeDefined();

    const { agent, auth } = await signIn();

    const me = await agent.get("/api/me").set(auth);
    expect(me.status, "GET /api/me").toBe(200);
    expect(me.body).toMatchObject({ email: DEMO_USER.email, id: expect.any(String), name: expect.any(String) });

    const added = await agent.post("/api/cart/items").set(auth).send({ productId: mug.id, quantity: 2 });
    expect(added.status, "POST /api/cart/items").toBe(201);

    const cart = await agent.get("/api/cart").set(auth);
    expect(cart.status, "GET /api/cart").toBe(200);
    expect(cart.body.items).toEqual([{ productId: mug.id, quantity: 2 }]);

    const order = await agent.post("/api/checkout").set(auth);
    expect(order.status, "POST /api/checkout").toBe(201);
    expect(order.body).toMatchObject({ orderId: expect.any(String), totalCents: mug.priceCents * 2 });

    const after = await agent.get("/api/cart").set(auth);
    expect(after.body.items).toEqual([]);
  });
});
