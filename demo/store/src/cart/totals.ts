import { getProduct } from "../catalog/products";
import type { CartLine, CartSummary, SummaryLine } from "../contracts/cart";

export function computeTotals(lines: CartLine[]): CartSummary {
  const summaryLines: SummaryLine[] = [];
  for (const line of lines) {
    const product = getProduct(line.productId);
    if (!product) continue;
    summaryLines.push({
      ...line,
      name: product.name,
      emoji: product.emoji,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * line.quantity,
    });
  }

  const subtotalCents = summaryLines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  return {
    lines: summaryLines,
    itemCount: summaryLines.reduce((sum, l) => sum + l.quantity, 0),
    subtotalCents,
    totalCents: subtotalCents,
  };
}
