import type { User } from "../contracts/user";

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

const carts = new Map<string, Cart>();

export function getCart(user: User): Cart {
  return carts.get(user.id) ?? { items: [] };
}

export function addItem(user: User, productId: string, quantity: number): Cart {
  const cart = getCart(user);
  const existing = cart.items.find((item) => item.productId === productId);
  const items = existing
    ? cart.items.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item))
    : [...cart.items, { productId, quantity }];
  carts.set(user.id, { items });
  return { items };
}

export function clearCart(user: User): void {
  carts.delete(user.id);
}
