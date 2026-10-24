import cors from "cors";
import express from "express";
import { HttpError } from "./http-error.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", productsRouter(db));
  app.use("/api", ordersRouter(db));

  app.use("/api", (_req, _res) => {
    throw new HttpError(404, "Not found");
  });
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
