import { randomUUID } from "node:crypto";
import type { CartSummary } from "../contracts/cart";
import type { Order } from "../contracts/order";

const orders = new Map<string, Order>();

export function createOrder(cartId: string, summary: CartSummary): Order {
  const order: Order = {
    id: `ord_${randomUUID().slice(0, 8)}`,
    cartId,
    lines: summary.lines,
    totalCents: summary.totalCents,
    createdAt: new Date().toISOString(),
  };
  orders.set(order.id, order);
  return order;
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}
