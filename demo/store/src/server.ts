import express from "express";
import { cartRouter } from "./cart/routes";
import { catalogRouter } from "./catalog/routes";
import { checkoutRouter } from "./checkout/routes";

export const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", catalogRouter);
app.use("/api", cartRouter);
app.use("/api", checkoutRouter);
