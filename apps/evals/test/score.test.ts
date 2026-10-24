import { describe, expect, it } from "vitest";
import { metrics, summarize } from "../src/aggregate";
import type { EvalCase } from "../src/case";
import { type Finding, scoreRun } from "../src/score";

const twoAgents: EvalCase = {
  id: "t",
  title: "t",
  why: "t",
  agents: [
    { handle: "a", prompt: { pointed: "p", natural: "n" } },
    {
      handle: "b",
      prompt: { pointed: "p", natural: "n" },
      start: { after: { agent: "a", event: "firstEdit" } },
    },
  ],
  expect: [{ agents: ["a", "b"], type: "duplicate", evidence: ["merge"] }],
  checks: [{ id: "merge", kind: "mergeConflict", agents: ["a", "b"] }],
};

const row = (over: Partial<Finding>): Finding => ({
  id: "r1",
  type: "duplicate",
  relation: "duplicate",
  action: "block",
  source: "rule",
  agents: ["b", "a"],
  at: 15_000,
  reason: "why",
  ...over,
});

const timing = [
  { handle: "a", startedAt: 0, firstEditAt: 5_000 },
  { handle: "b", startedAt: 10_000, firstEditAt: 20_000 },
];
const merged = (value: boolean) => [{ id: "merge", value, detail: "" }];

describe("scoreRun", () => {
  it("counts a matching row as a hit, timed from the later agent's start", () => {
    const s = scoreRun(twoAgents, [row({})], timing, merged(true));
    expect(s.expectations[0]).toMatchObject({ outcome: "hit", detectSec: 5, beforeFirstEdit: true });
    expect(s.falsePositives).toEqual([]);
  });

  it("counts a hit even when the clash never materialized: LB prevented it", () => {
    expect(scoreRun(twoAgents, [row({})], timing, merged(false)).expectations[0]?.outcome).toBe("hit");
  });

  it("calls a row of the wrong type on the right pair a mislabel", () => {
    const s = scoreRun(
      twoAgents,
      [row({ type: "conflict", relation: "textual_conflict" })],
      timing,
      merged(true),
    );
    expect(s.expectations[0]?.outcome).toBe("mislabel");
  });

  it("prefers the matching type when a pair has several rows", () => {
    const rows = [row({ id: "x", type: "conflict", at: 11_000 }), row({ id: "y", at: 30_000 })];
    expect(scoreRun(twoAgents, rows, timing, merged(true)).expectations[0]).toMatchObject({
      outcome: "hit",
      beforeFirstEdit: false,
    });
  });

  it("separates misses from clashes that never happened", () => {
    expect(scoreRun(twoAgents, [], timing, merged(true)).expectations[0]?.outcome).toBe("miss");
    expect(scoreRun(twoAgents, [], timing, merged(false)).expectations[0]?.outcome).toBe("unmaterialized");
  });

  it("ignores normal rows and groups other pairs into one false positive each", () => {
    const rows = [
      row({ type: "normal" }),
      row({ id: "p", agents: ["a", "c"] }),
      row({ id: "q", agents: ["c", "a"] }),
    ];
    const s = scoreRun(twoAgents, rows, timing, merged(true));
    expect(s.expectations[0]?.outcome).toBe("miss");
    expect(s.falsePositives).toEqual([{ agents: ["a", "c"], types: ["duplicate"], rows: 2, reason: "why" }]);
  });
});

describe("metrics", () => {
  const control: EvalCase = { ...twoAgents, id: "c", expect: [], checks: [] };
  const record = (c: EvalCase, findings: Finding[], value: boolean) => ({
    caseId: c.id,
    variant: "pointed" as const,
    run: 1,
    score: scoreRun(c, findings, timing, merged(value)),
    costUsd: 0.5,
    wallSec: 60,
  });

  it("computes recall over materialized or caught clashes and precision over pair groups", () => {
    const runs = [
      record(twoAgents, [row({})], true),
      record(twoAgents, [], true),
      record(twoAgents, [], false),
      record(control, [row({})], false),
      record(control, [], false),
    ];
    const m = metrics(runs);
    expect(m).toMatchObject({
      hits: 1,
      misses: 1,
      unmaterialized: 1,
      falsePositives: 1,
      controlRuns: 2,
      noisyControlRuns: 1,
    });
    expect(m.recall).toBe(0.5);
    expect(m.precision).toBe(0.5);
    expect(summarize(runs).costUsd).toBe(2.5);
  });

  it("leaves harness errors out", () => {
    const failed = { ...record(twoAgents, [], true), error: "boom" };
    expect(metrics([failed]).expected).toBe(0);
  });
});
