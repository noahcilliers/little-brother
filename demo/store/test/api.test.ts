import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Product } from "../src/contracts/product";
import { app } from "../src/server";

const newCart = () => ({ "x-cart-id": `test-${randomUUID()}` });

async function stockOf(id: string): Promise<number> {
  const res = await request(app).get("/api/products");
  const product = (res.body as Product[]).find((p) => p.id === id);
  if (!product) throw new Error(`${id} missing from the catalog`);
  return product.stock;
}

describe("catalog", () => {
  it("lists products and filters by category", async () => {
    const all = await request(app).get("/api/products");
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThan(0);

    const tea = await request(app).get("/api/products?category=tea");
    expect((tea.body as Product[]).every((p) => p.category === "tea")).toBe(true);

    const bad = await request(app).get("/api/products?category=shoes");
    expect(bad.status).toBe(400);
  });

  it("finds a product by slug", async () => {
    const res = await request(app).get("/api/products/stoneware-mug");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Stoneware Mug");
  });
});

describe("cart and checkout", () => {
  it("adds, updates and removes items", async () => {
    const cart = newCart();
    await request(app).post("/api/cart/items").set(cart).send({ productId: "p_washi", quantity: 2 });
    const updated = await request(app).patch("/api/cart/items/p_washi").set(cart).send({ quantity: 3 });
    expect(updated.body.itemCount).toBe(3);
    expect(updated.body.totalCents).toBe(3600);

    const removed = await request(app).delete("/api/cart/items/p_washi").set(cart);
    expect(removed.body.lines).toEqual([]);
  });

  it("requires a cart id", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(400);
  });

  it("checks out and the catalog shows the lower stock right away", async () => {
    const before = await stockOf("p_stoneware_mug");
    const cart = newCart();
    await request(app).post("/api/cart/items").set(cart).send({ productId: "p_stoneware_mug", quantity: 1 });

    const order = await request(app).post("/api/checkout").set(cart);
    expect(order.status).toBe(201);
    expect(order.body.totalCents).toBe(2600);

    expect(await stockOf("p_stoneware_mug")).toBe(before - 1);
    const empty = await request(app).get("/api/cart").set(cart);
    expect(empty.body.itemCount).toBe(0);
  });

  it("refuses to sell more than is in stock", async () => {
    const cart = newCart();
    const stock = await stockOf("p_earl_grey");
    await request(app).post("/api/cart/items").set(cart).send({ productId: "p_earl_grey", quantity: stock + 1 });
    const res = await request(app).post("/api/checkout").set(cart);
    expect(res.status).toBe(409);
    expect(await stockOf("p_earl_grey")).toBe(stock);
  });

  it("refuses an empty cart", async () => {
    const res = await request(app).post("/api/checkout").set(newCart());
    expect(res.status).toBe(400);
  });
});
