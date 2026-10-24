import { Router } from "express";
import { HttpError } from "../http-error.js";

const SELECT = `SELECT id, name, description, price_cents AS priceCents, image_url AS imageUrl,
  category, stock FROM products`;

export function productsRouter(db) {
  const router = Router();

  router.get("/products", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const products = db
      .prepare(`${SELECT} WHERE (? = '' OR name LIKE ? OR description LIKE ?) AND (? = '' OR category = ?) ORDER BY id`)
      .all(q, `%${q}%`, `%${q}%`, category, category);
    res.json({ products });
  });

  router.get("/products/:id", (req, res) => {
    const product = db.prepare(`${SELECT} WHERE id = ?`).get(Number(req.params.id));
    if (!product) throw new HttpError(404, "Product not found");
    res.json({ product });
  });

  router.get("/categories", (_req, res) => {
    const rows = db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all();
    res.json({ categories: rows.map((r) => r.category) });
  });

  return router;
}
