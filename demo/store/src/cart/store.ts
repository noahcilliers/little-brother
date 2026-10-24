import type { CartLine } from "../contracts/cart";

/** Carts keyed by the anonymous cart id the storefront keeps in localStorage. */
const carts = new Map<string, CartLine[]>();

export function getLines(cartId: string): CartLine[] {
  return carts.get(cartId) ?? [];
}

/** Sets a line's quantity; 0 removes it. */
export function setQuantity(cartId: string, productId: string, quantity: number): CartLine[] {
  const others = getLines(cartId).filter((l) => l.productId !== productId);
  const lines = quantity > 0 ? [...others, { productId, quantity }] : others;
  carts.set(cartId, lines);
  return lines;
}

export function addQuantity(cartId: string, productId: string, quantity: number): CartLine[] {
  const current = getLines(cartId).find((l) => l.productId === productId)?.quantity ?? 0;
  return setQuantity(cartId, productId, current + quantity);
}

export function clearCart(cartId: string): void {
  carts.delete(cartId);
}
