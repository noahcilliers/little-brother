import { describe, expect, it } from "vitest";
import { computeTotals } from "../src/cart/totals";

describe("computeTotals", () => {
  it("prices each line from the catalog", () => {
    const summary = computeTotals([
      { productId: "p_dot_notebook", quantity: 2 },
      { productId: "p_sencha", quantity: 1 },
    ]);
    expect(summary.lines.map((l) => l.lineTotalCents)).toEqual([3600, 2200]);
    expect(summary.itemCount).toBe(3);
    expect(summary.subtotalCents).toBe(5800);
    expect(summary.totalCents).toBe(5800);
  });

  it("skips products that no longer exist", () => {
    const summary = computeTotals([{ productId: "p_gone", quantity: 1 }]);
    expect(summary.lines).toEqual([]);
    expect(summary.totalCents).toBe(0);
  });
});
