import { Router } from "express";
import { HttpError } from "../http-error.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseOrder(body) {
  const customer = body?.customer ?? {};
  for (const field of ["name", "email", "address"]) {
    if (typeof customer[field] !== "string" || !customer[field].trim()) {
      throw new HttpError(400, `customer.${field} is required`);
    }
  }
  if (!EMAIL.test(customer.email)) throw new HttpError(400, "customer.email is invalid");
  if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, "items must be a non-empty array");

  // Merge duplicate lines so the stock check sees the true requested quantity.
  const quantities = new Map();
  for (const item of body.items) {
    if (!Number.isInteger(item?.productId) || !Number.isInteger(item?.quantity) || item.quantity < 1) {
      throw new HttpError(400, "each item needs an integer productId and quantity >= 1");
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return { customer, quantities };
}

function loadOrder(db, id) {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!row) return null;
  const items = db
    .prepare(
      "SELECT product_id AS productId, name, unit_price_cents AS unitPriceCents, quantity FROM order_items WHERE order_id = ?",
    )
    .all(id);
  return {
    id: row.id,
    status: row.status,
    totalCents: row.total_cents,
    customer: { name: row.customer_name, email: row.customer_email, address: row.customer_address },
    items,
    createdAt: row.created_at,
  };
}

export function ordersRouter(db) {
  const router = Router();

  router.post("/orders", (req, res) => {
    const { customer, quantities } = parseOrder(req.body);
    const getProduct = db.prepare("SELECT id, name, price_cents, stock FROM products WHERE id = ?");
    // Prices come from the DB, never the client, so a tampered cart can't change the total.
    const lines = [...quantities].map(([productId, quantity]) => {
      const product = getProduct.get(productId);
      if (!product) throw new HttpError(400, `product ${productId} does not exist`);
      if (product.stock < quantity) throw new HttpError(409, `only ${product.stock} of "${product.name}" left`);
      return { product, quantity };
    });
    const total = lines.reduce((sum, l) => sum + l.product.price_cents * l.quantity, 0);

    db.exec("BEGIN");
    try {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO orders (customer_name, customer_email, customer_address, total_cents) VALUES (?, ?, ?, ?)")
        .run(customer.name.trim(), customer.email.trim(), customer.address.trim(), total);
      const addItem = db.prepare(
        "INSERT INTO order_items (order_id, product_id, name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)",
      );
      const decrement = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?");
      for (const { product, quantity } of lines) {
        addItem.run(lastInsertRowid, product.id, product.name, product.price_cents, quantity);
        if (decrement.run(quantity, product.id, quantity).changes === 0) {
          throw new HttpError(409, `"${product.name}" sold out`);
        }
      }
      db.exec("COMMIT");
      res.status(201).json({ order: loadOrder(db, Number(lastInsertRowid)) });
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  });

  router.get("/orders/:id", (req, res) => {
    const order = loadOrder(db, Number(req.params.id));
    if (!order) throw new HttpError(404, "Order not found");
    res.json({ order });
  });

  return router;
}
