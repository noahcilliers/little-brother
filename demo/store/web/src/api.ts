import type { CartSummary } from "../../src/contracts/cart";
import type { Order } from "../../src/contracts/order";
import type { Category, Product } from "../../src/contracts/product";

const CART_KEY = "qk-cart-id";

/** Anonymous cart: the id lives in this browser, the contents on the API. */
function cartId(): string {
  const existing = localStorage.getItem(CART_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(CART_KEY, created);
  return created;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-cart-id": cartId(), ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${init.method ?? "GET"} ${path} failed (${res.status})`);
  return body as T;
}

export const api = {
  categories: () => call<Category[]>("/categories"),
  products: (category?: Category) => call<Product[]>(category ? `/products?category=${category}` : "/products"),
  cart: () => call<CartSummary>("/cart"),
  add: (productId: string) =>
    call<CartSummary>("/cart/items", { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) }),
  setQuantity: (productId: string, quantity: number) =>
    call<CartSummary>(`/cart/items/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  checkout: () => call<Order>("/checkout", { method: "POST" }),
};
