import { Router } from "express";
import { decrementStock, getProduct } from "../catalog/products";
import { cartIdOf } from "../cart/routes";
import { clearCart, getLines } from "../cart/store";
import { computeTotals } from "../cart/totals";
import { createOrder, getOrder } from "./orders";

export const checkoutRouter = Router();

checkoutRouter.post("/checkout", (req, res) => {
  const cartId = cartIdOf(req, res);
  if (!cartId) return;
  const summary = computeTotals(getLines(cartId));
  if (summary.lines.length === 0) {
    res.status(400).json({ error: "cart is empty" });
    return;
  }

  // Check every line before touching stock, so a failed checkout changes nothing.
  for (const line of summary.lines) {
    const stock = getProduct(line.productId)?.stock ?? 0;
    if (stock < line.quantity) {
      res.status(409).json({ error: `only ${stock} of ${line.name} left` });
      return;
    }
  }
  for (const line of summary.lines) decrementStock(line.productId, line.quantity);

  const order = createOrder(cartId, summary);
  clearCart(cartId);
  res.status(201).json(order);
});

checkoutRouter.get("/orders/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(order);
});
