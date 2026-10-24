import { randomUUID } from "node:crypto";
import { Router } from "express";
import { products } from "../../db/schema/products";
import { currentUser, requireUser } from "../auth/require-user";
import { addItem, clearCart, getCart } from "./cart";

export const checkoutRouter = Router();

checkoutRouter.get("/cart", requireUser, (_req, res) => {
  res.json(getCart(currentUser(res)));
});

checkoutRouter.post("/cart/items", requireUser, (req, res) => {
  const { productId, quantity = 1 } = req.body as { productId?: string; quantity?: number };
  if (!productId || !products.has(productId) || !Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "unknown product or bad quantity" });
    return;
  }
  res.status(201).json(addItem(currentUser(res), productId, quantity));
});

checkoutRouter.post("/checkout", requireUser, (_req, res) => {
  const user = currentUser(res);
  const { items } = getCart(user);
  if (items.length === 0) {
    res.status(400).json({ error: "cart is empty" });
    return;
  }
  const totalCents = items.reduce((sum, i) => sum + (products.get(i.productId)?.priceCents ?? 0) * i.quantity, 0);
  clearCart(user);
  res.status(201).json({ orderId: randomUUID(), totalCents });
});
