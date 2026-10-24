export type Category = "stationery" | "kitchen" | "tea";

export const CATEGORIES: Category[] = ["stationery", "kitchen", "tea"];

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  /** Price in US cents. */
  priceCents: number;
  stock: number;
  /** Stands in for a product photo so the demo needs no image assets. */
  emoji: string;
}
