import { type Request, type Response, Router } from "express";
import { getProduct } from "../catalog/products";
import { addQuantity, getLines, setQuantity } from "./store";
import { computeTotals } from "./totals";

export const cartRouter = Router();

/** Every cart request names its cart; the storefront generates the id. */
export function cartIdOf(req: Request, res: Response): string | undefined {
  const id = req.header("x-cart-id");
  if (!id) res.status(400).json({ error: "missing x-cart-id header" });
  return id;
}

function quantityOf(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

cartRouter.get("/cart", (req, res) => {
  const cartId = cartIdOf(req, res);
  if (!cartId) return;
  res.json(computeTotals(getLines(cartId)));
});

cartRouter.post("/cart/items", (req, res) => {
  const cartId = cartIdOf(req, res);
  if (!cartId) return;
  const { productId } = req.body as { productId?: string };
  const quantity = quantityOf(req.body.quantity ?? 1);
  if (!productId || !getProduct(productId) || !quantity) {
    res.status(400).json({ error: "need a known productId and a positive quantity" });
    return;
  }
  res.json(computeTotals(addQuantity(cartId, productId, quantity)));
});

cartRouter.patch("/cart/items/:productId", (req, res) => {
  const cartId = cartIdOf(req, res);
  if (!cartId) return;
  const quantity = quantityOf(req.body.quantity);
  if (quantity === undefined) {
    res.status(400).json({ error: "quantity must be a whole number ≥ 0" });
    return;
  }
  res.json(computeTotals(setQuantity(cartId, req.params.productId, quantity)));
});

cartRouter.delete("/cart/items/:productId", (req, res) => {
  const cartId = cartIdOf(req, res);
  if (!cartId) return;
  res.json(computeTotals(setQuantity(cartId, req.params.productId, 0)));
});
