import { describe, expect, it } from "vitest";
import type { EvalRunRow } from "../src/eval-board";
import { summarizeEvalRuns } from "../src/eval-summary";

const row = (over: Partial<EvalRunRow>): EvalRunRow => ({
  runKey: `k${Math.random()}`,
  batch: "pilot/large",
  suite: "large",
  caseId: "dup",
  variant: "pointed",
  arm: "on",
  run: 1,
  model: "sonnet",
  costUsd: 0.2,
  newTokens: 1000,
  wallSec: 100,
  finalSuccess: true,
  mergeConflict: false,
  interference: null,
  catches: 1,
  hits: 1,
  mislabels: 0,
  misses: 0,
  falsePositives: 0,
  detectSec: 10,
  voided: false,
  at: 0,
  ...over,
});

describe("summarizeEvalRuns", () => {
  it("groups by batch, suite and arm and averages only counted runs", () => {
    const out = summarizeEvalRuns([
      row({ arm: "off", mergeConflict: true, costUsd: 0.4, hits: 0, misses: 1 }),
      row({ arm: "off", mergeConflict: false, costUsd: 0.2, hits: 0, misses: 1 }),
      row({ costUsd: 0.1 }),
      row({ costUsd: 0.3, mislabels: 1, hits: 0 }),
      row({ costUsd: 0.01, voided: true, finalSuccess: false }),
    ]);
    expect(out.map((s) => s.arm)).toEqual(["off", "on"]);
    const [off, on] = out;
    expect(off?.mergeConflictRate).toBe(0.5);
    expect(off?.meanCostUsd).toBeCloseTo(0.3);
    expect(off?.caught).toBe(0);
    expect(on?.runs).toBe(2);
    expect(on?.voided).toBe(1);
    expect(on?.successRate).toBe(1);
    expect(on?.meanCostUsd).toBeCloseTo(0.2);
    expect(on).toMatchObject({ expected: 2, caught: 2 });
  });

  it("reports null rates when no counted run graded the field", () => {
    const [s] = summarizeEvalRuns([row({ finalSuccess: null, mergeConflict: null }), row({ voided: true })]);
    expect(s?.successRate).toBeNull();
    expect(s?.interferenceRate).toBeNull();
    expect(s?.runs).toBe(1);
  });

  it("keeps a group whose runs were all voided, with no averages", () => {
    const [s] = summarizeEvalRuns([row({ voided: true })]);
    expect(s).toMatchObject({ runs: 0, voided: 1, meanCostUsd: null, successRate: null });
  });
});
