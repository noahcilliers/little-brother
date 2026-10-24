import type { User } from "../../src/contracts/user";

export interface Product {
  id: string;
  name: string;
  priceCents: number;
}
export interface Cart {
  items: { productId: string; quantity: number }[];
}

let token: string | undefined;

/** Relative /api URLs: the API must be reachable from the storefront's origin. */
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  async login(email: string, password: string): Promise<User> {
    const result = await call<{ token?: string }>("POST", "/auth/login", { email, password });
    token = result.token;
    return call<User>("GET", "/me");
  },
  products: () => call<Product[]>("GET", "/products"),
  cart: () => call<Cart>("GET", "/cart"),
  addToCart: (productId: string) => call<Cart>("POST", "/cart/items", { productId, quantity: 1 }),
  checkout: () => call<{ orderId: string; totalCents: number }>("POST", "/checkout"),
};
