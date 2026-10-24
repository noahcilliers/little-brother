export interface CartLine {
  productId: string;
  quantity: number;
}

export interface SummaryLine extends CartLine {
  name: string;
  emoji: string;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CartSummary {
  lines: SummaryLine[];
  itemCount: number;
  subtotalCents: number;
  totalCents: number;
}
