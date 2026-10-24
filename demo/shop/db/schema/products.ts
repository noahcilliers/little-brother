export interface Product {
  id: string;
  name: string;
  priceCents: number;
}

/** In-memory table; the demo keeps storage trivial so the coordination story stays in focus. */
export const products = new Map<string, Product>([
  ["p_mug", { id: "p_mug", name: "Little Brother mug", priceCents: 1800 }],
  ["p_tee", { id: "p_tee", name: "Agent-proof tee", priceCents: 2600 }],
  ["p_sticker", { id: "p_sticker", name: "Sticker pack", priceCents: 500 }],
]);
