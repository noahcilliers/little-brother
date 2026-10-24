import { describe, expect, it } from "vitest";
import type { RunRecord } from "../src/aggregate";
import { summarize } from "../src/aggregate";
import type { Arm } from "../src/arm";
import { measuredSavings } from "../src/measured-savings";
import { parseOptions } from "../src/options";
import { savingsSection } from "../src/report-savings";

const run = (arm: Arm | undefined, tokens: number, over: Partial<RunRecord> = {}): RunRecord => ({
  caseId: "dup",
  variant: "pointed",
  ...(arm ? { arm } : {}),
  run: 1,
  score: {
    control: false,
    expectations: [{ agents: ["a", "b"], type: "duplicate", outcome: "miss", materialized: arm === "off" }],
    falsePositives: [],
  },
  costUsd: tokens / 10_000,
  tokens: { input: 0, output: tokens, cacheCreation: 0, cacheRead: 99_999 },
  wallSec: 60,
  ...over,
});

const hooks = (tokensSaved: number, injectedTokens: number) => ({
  preToolUseMs: [],
  calls: 0,
  hookSec: 0,
  timeouts: 0,
  prePhasesMs: {},
  injectedTokens,
  tokensSaved,
});

describe("measuredSavings", () => {
  it("is undefined without any off run", () => {
    expect(measuredSavings([run("on", 100), run(undefined, 100)])).toBeUndefined();
  });

  it("subtracts mean on tokens from mean off tokens, next to the estimate", () => {
    const s = measuredSavings([
      run("off", 50_000),
      run("off", 70_000),
      run("on", 30_000, { hooks: hooks(25_000, 1_000) }),
      run(undefined, 40_000, { hooks: hooks(15_000, 1_000) }),
      run("off", 1, { error: "boom" }),
    ]);
    const r = s?.rows[0];
    expect(s?.rows).toHaveLength(1);
    expect(r?.off).toMatchObject({ runs: 2, tokens: 60_000, clashRate: 1 });
    expect(r?.on).toMatchObject({ runs: 2, tokens: 35_000, clashRate: 0 });
    expect(r?.measuredTokens).toBe(25_000);
    expect(r?.measuredUsd).toBeCloseTo(2.5);
    // Welch: sqrt(var_off / 2 + var_on / 2) with sample variances 2e8 and 5e7.
    expect(r?.measuredSe).toBeCloseTo(Math.sqrt(1e8 + 2.5e7));
    expect(r?.estimatedTokens).toBe(20_000);
    expect(r?.estimatedNetTokens).toBe(19_000);
    expect(s?.total.measuredTokens).toBe(25_000);
  });

  it("skips groups missing an arm and leaves spread unknown with one run", () => {
    const s = measuredSavings([
      run("off", 10_000),
      run("on", 4_000),
      run("off", 9_000, { caseId: "lonely" }),
    ]);
    expect(s?.rows.map((r) => r.caseId)).toEqual(["dup"]);
    expect(s?.rows[0]?.measuredSe).toBeNull();
    expect(s?.total.measuredSe).toBeNull();
  });
});

describe("summarize with arms", () => {
  it("keeps off runs out of detection and latency but in cost and savings", () => {
    const s = summarize([run("off", 50_000), run("on", 30_000)]);
    expect(s.overall.misses).toBe(1);
    expect(s.cases).toHaveLength(1);
    expect(s.costUsd).toBeCloseTo(8);
    expect(s.savings?.total.measuredTokens).toBe(20_000);
  });
});

describe("savingsSection", () => {
  it("renders nothing without off runs and flags gaps within noise", () => {
    expect(savingsSection(undefined)).toEqual([]);
    const s = measuredSavings([run("off", 50_000), run("off", 90_000), run("on", 60_000), run("on", 70_000)]);
    expect(savingsSection(s).join("\n")).toContain("(noise)");
  });
});

describe("--arm", () => {
  it("defaults to on and runs off first for both", () => {
    expect(parseOptions([]).arms).toEqual(["on"]);
    expect(parseOptions(["--arm", "both"]).arms).toEqual(["off", "on"]);
    expect(() => parseOptions(["--arm", "maybe"])).toThrow("--arm");
  });
});
