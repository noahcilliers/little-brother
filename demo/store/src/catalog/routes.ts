import { Router } from "express";
import { CATEGORIES, type Category } from "../contracts/product";
import { getProductBySlug, listProducts } from "./products";

export const catalogRouter = Router();

const isCategory = (value: unknown): value is Category => CATEGORIES.includes(value as Category);

catalogRouter.get("/categories", (_req, res) => {
  res.json(CATEGORIES);
});

catalogRouter.get("/products", (req, res) => {
  const { category } = req.query;
  if (category !== undefined && !isCategory(category)) {
    res.status(400).json({ error: `unknown category ${String(category)}` });
    return;
  }
  res.json(listProducts(category));
});

catalogRouter.get("/products/:slug", (req, res) => {
  const product = getProductBySlug(req.params.slug);
  if (!product) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(product);
});
