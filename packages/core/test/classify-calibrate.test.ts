import { describe, expect, it } from "vitest";
import { precisionByRelation, recalibrate } from "../src/classify/calibrate";

const rows = (relation: string, confirmed: number, fp: number) => [
  ...Array.from({ length: confirmed }, () => ({ relation, feedback: "confirmed" })),
  ...Array.from({ length: fp }, () => ({ relation, feedback: "false_positive" })),
];

describe("calibrate", () => {
  it("computes per-relation precision from feedback", () => {
    const s = precisionByRelation([...rows("duplicate", 3, 1), { relation: "duplicate" }]);
    expect(s.duplicate).toEqual({ confirmed: 3, falsePositive: 1, precision: 0.75 });
    expect(s.textual_conflict).toBeUndefined();
  });
  it("raises thresholds under target, eases them back above, ignores thin data", () => {
    const stats = precisionByRelation([
      ...rows("semantic_conflict", 6, 4),
      ...rows("duplicate", 20, 0),
      ...rows("textual_conflict", 1, 3),
    ]);
    const t = recalibrate({ duplicate: 0.8 }, stats);
    expect(t.semantic_conflict).toBe(0.9);
    expect(t.duplicate).toBe(0.78);
    expect(t.textual_conflict).toBeUndefined();
  });
});
