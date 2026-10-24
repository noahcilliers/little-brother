import { Router } from "express";

export const checkoutRouter = Router();

checkoutRouter.get("/cart", (_req, res) => {
  res.status(501).json({ error: "cart not implemented" });
});

checkoutRouter.post("/cart/items", (_req, res) => {
  res.status(501).json({ error: "cart not implemented" });
});

checkoutRouter.post("/checkout", (_req, res) => {
  res.status(501).json({ error: "checkout not implemented" });
});
