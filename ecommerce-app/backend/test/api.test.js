import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

let server;
let base;

before(async () => {
  server = createApp(openDb(":memory:")).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const customer = { name: "Ada", email: "ada@example.com", address: "1 Main St" };

test("lists, filters and fetches products", async () => {
  const all = await (await fetch(`${base}/products`)).json();
  assert.equal(all.products.length, 8);
  const shoes = await (await fetch(`${base}/products?category=footwear`)).json();
  assert.ok(shoes.products.every((p) => p.category === "footwear"));
  const mug = await (await fetch(`${base}/products?q=mug`)).json();
  assert.equal(mug.products[0].name, "Ceramic Mug");
  assert.equal((await fetch(`${base}/products/999`)).status, 404);
  const cats = await (await fetch(`${base}/categories`)).json();
  assert.deepEqual(cats.categories, ["apparel", "electronics", "footwear", "home"]);
});

test("places an order with server-side prices and decrements stock", async () => {
  const res = await post("/orders", { customer, items: [{ productId: 1, quantity: 2 }, { productId: 1, quantity: 1 }, { productId: 5, quantity: 1 }] });
  assert.equal(res.status, 201);
  const { order } = await res.json();
  assert.equal(order.totalCents, 1999 * 3 + 1499);
  assert.equal(order.items.length, 2);
  const fetched = await (await fetch(`${base}/orders/${order.id}`)).json();
  assert.deepEqual(fetched.order, order);
  const { product } = await (await fetch(`${base}/products/1`)).json();
  assert.equal(product.stock, 47);
});

test("rejects bad orders", async () => {
  assert.equal((await post("/orders", { customer, items: [] })).status, 400);
  assert.equal((await post("/orders", { customer: { ...customer, email: "x" }, items: [{ productId: 1, quantity: 1 }] })).status, 400);
  assert.equal((await post("/orders", { customer, items: [{ productId: 999, quantity: 1 }] })).status, 400);
  const tooMany = await post("/orders", { customer, items: [{ productId: 4, quantity: 1000 }] });
  assert.equal(tooMany.status, 409);
  assert.equal((await fetch(`${base}/orders/999`)).status, 404);
});
