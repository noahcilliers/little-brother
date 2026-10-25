import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "../src/constant-time";
import type { EvalRunRow, EvalSummary } from "../src/eval-board";
import { benchmarkBatches, benchRun, type EvalBatchConfig, EvalRunPost } from "../src/eval-live";

const summary = (over: Partial<EvalSummary>): EvalSummary => ({
  batch: "results/a",
  suite: "stale",
  arm: "on",
  model: "sonnet",
  runs: 3,
  voided: 1,
  successRate: 1,
  mergeConflictRate: 0,
  interferenceRate: 0,
  meanCostUsd: 0.5,
  meanNewTokens: 1000,
  meanWallSec: 60,
  expected: 3,
  caught: 2,
  ...over,
});

const config = (over: Partial<EvalBatchConfig>): EvalBatchConfig => ({
  batch: "results/a",
  suite: "stale",
  model: "sonnet",
  arms: ["off", "on"],
  planned: 18,
  startedAt: 100,
  finishedAt: null,
  skipped: 0,
  ...over,
});

const row: EvalRunRow = {
  runKey: "results/a/c/pointed/on/1",
  batch: "results/a",
  suite: "stale",
  caseId: "c",
  variant: "pointed",
  arm: "on",
  run: 1,
  model: "sonnet",
  costUsd: 0.3,
  newTokens: 900,
  wallSec: 40,
  finalSuccess: true,
  mergeConflict: false,
  interference: 0,
  catches: 1,
  hits: 1,
  mislabels: 0,
  misses: 0,
  falsePositives: 0,
  detectSec: 4,
  voided: false,
  at: 5,
};

describe("benchmarkBatches", () => {
  it("counts graded and voided runs across arms against the announced plan", () => {
    const [b] = benchmarkBatches([config({})], [summary({}), summary({ arm: "off", runs: 4, voided: 1 })]);
    expect(b).toMatchObject({ status: "running", graded: 9, voided: 2, planned: 18, startedAt: 100 });
    expect(b?.perArm.map((s) => s.arm)).toEqual(["on", "off"]);
  });

  it("marks finished batches and shows a just-announced one with no runs yet", () => {
    const out = benchmarkBatches(
      [config({ finishedAt: 200 }), config({ batch: "results/b", startedAt: 300 })],
      [summary({})],
    );
    expect(out.map((b) => [b.batch, b.status, b.graded])).toEqual([
      ["results/b", "running", 0],
      ["results/a", "finished", 4],
    ]);
  });

  it("lists after-the-fact batches after announced ones, planned equal to graded", () => {
    const out = benchmarkBatches(
      [config({})],
      [summary({ batch: "pilot/x", suite: "large" }), summary({ batch: "pilot/y", model: "opus" })],
    );
    expect(out.map((b) => b.batch)).toEqual(["results/a", "pilot/y", "pilot/x"]);
    expect(out[2]).toMatchObject({ status: "published", suite: "large", planned: 4, startedAt: null });
  });

  it("never plans fewer runs than were graded, and honours the limit", () => {
    const [b] = benchmarkBatches([config({ planned: 2 })], [summary({})]);
    expect(b?.planned).toBe(4);
    expect(benchmarkBatches([config({}), config({ batch: "z" })], [], 1)).toHaveLength(1);
  });
});

describe("EvalRunPost", () => {
  it("accepts a row for its batch and defaults the replay to null", () => {
    const p = EvalRunPost.parse({ batch: "results/a", row });
    expect(p.replay).toBeNull();
  });

  it("rejects a row filed under another batch", () => {
    expect(EvalRunPost.safeParse({ batch: "results/b", row }).success).toBe(false);
  });
});

describe("benchRun", () => {
  it("keeps outcome fields only", () => {
    const r = benchRun(row, 9);
    expect(r).toMatchObject({ caseId: "c", hits: 1, landedAt: 9 });
    expect(r).not.toHaveProperty("detectSec");
    expect(r).not.toHaveProperty("variant");
  });
});

describe("constantTimeEqual", () => {
  it("matches equal strings only", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "ab")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
