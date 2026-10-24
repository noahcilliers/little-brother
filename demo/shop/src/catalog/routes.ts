import { Router } from "express";
import { products } from "../../db/schema/products";

export const catalogRouter = Router();

catalogRouter.get("/products", (_req, res) => {
  res.json([...products.values()]);
});
