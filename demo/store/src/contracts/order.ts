import type { SummaryLine } from "./cart";

export interface Order {
  id: string;
  cartId: string;
  lines: SummaryLine[];
  totalCents: number;
  createdAt: string;
}
