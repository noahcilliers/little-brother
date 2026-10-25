import { describe, expect, it } from "vitest";
import { scoreCandidates } from "../src/classify/candidates";
import { renderEvidence } from "../src/classify/evidence";
import { applyRules, classifyStructural } from "../src/classify/pipeline";
import { node, pair } from "./classify-fixtures";

describe("scoreCandidates", () => {
  const next = node({
    agentId: "a",
    topic: "db.users",
    touches: [{ path: "db/schema/users.ts", op: "create" }],
  });

  it("excludes same-agent active work but keeps same-agent failure memory", () => {
    const mine = node({ agentId: "a", touches: [{ path: "db/schema/users.ts", op: "write" }] });
    const myFailure = node({
      agentId: "a",
      outcome: "failed",
      touches: [{ path: "db/schema/users.ts", op: "write" }],
    });
    const pairs = scoreCandidates(next, [
      { node: mine, failedMemory: false },
      { node: myFailure, failedMemory: true },
    ]);
    expect(pairs.map((p) => p.other.id)).toEqual([myFailure.id]);
  });

  it("scores max weight plus a bonus per extra signal and records reasons", () => {
    const other = node({
      agentId: "b",
      topic: "db.users",
      touches: [{ path: "db/schema/users.ts", op: "create" }],
    });
    const [p] = scoreCandidates(next, [{ node: other, failedMemory: false }]);
    expect(p?.retrievalScore).toBe(1);
    expect(p?.reasons).toEqual(["both mutate db/schema/users.ts", "same topic db.users"]);
  });

  it("drops candidates with no signal and keeps overlaps beyond top-k", () => {
    const unrelated = node({ agentId: "b", touches: [{ path: "README.md", op: "write" }] });
    const topical = Array.from({ length: 3 }, () => node({ agentId: "c", topic: "db.users" }));
    const overlap = node({ agentId: "d", touches: [{ path: "db/schema/users.ts", op: "write" }] });
    const sim = node({ agentId: "e", kind: "intent" });
    const pairs = scoreCandidates(
      next,
      [unrelated, ...topical, sim]
        .map((n) => ({ node: n, failedMemory: false, similarity: 0.5 }))
        .concat([{ node: overlap, failedMemory: false, similarity: 0.5 }]),
      1,
    );
    const ids = pairs.map((p) => p.other.id);
    expect(ids).toContain(overlap.id);
    expect(ids).not.toContain(unrelated.id);
    expect(ids.length).toBeLessThanOrEqual(2);
  });

  it("uses similarity for intents only", () => {
    const intent = node({ agentId: "a", kind: "intent" });
    const other = node({ agentId: "b", kind: "intent" });
    const [p] = scoreCandidates(intent, [{ node: other, failedMemory: false, similarity: 0.9 }]);
    expect(p?.retrievalScore).toBeCloseTo(0.72);
  });
});

describe("applyRules", () => {
  it("most severe settled rule wins and carries all evidence", () => {
    const next = node({
      touches: [{ path: "src/pay.ts", symbol: "src/pay.ts::pay", op: "signature_change", lines: [1, 3] }],
    });
    const other = node({
      agentId: "b",
      touches: [{ path: "src/pay.ts", op: "write", lines: [2, 4] }],
      references: ["pay"],
    });
    const out = applyRules(pair(next, other));
    expect(out.verdict?.relation).toBe("semantic_conflict");
    expect(out.ruleId).toBe("R5");
    expect(out.verdict?.evidence.some((e) => e.startsWith("R1:"))).toBe(true);
  });
  it("returns hints when nothing settles", () => {
    const next = node({ touches: [{ path: "x.ts", op: "write", lines: [1, 2] }] });
    const other = node({ agentId: "b", touches: [{ path: "x.ts", op: "write", lines: [9, 10] }] });
    const out = applyRules(pair(next, other));
    expect(out.verdict).toBeNull();
    expect(out.hints.map((h) => h.rule)).toEqual(["R8"]);
  });
});

describe("classifyStructural demo scenarios", () => {
  it("two agents create users.ts → serialize", () => {
    const noah = node({ agentId: "noah", touches: [{ path: "db/schema/users.ts", op: "create" }] });
    const josh = node({ agentId: "josh", touches: [{ path: "db/schema/users.ts", op: "create" }] });
    const r = classifyStructural(josh, [{ node: noah, failedMemory: false }]);
    expect(r.judgments).toMatchObject([
      { relation: "textual_conflict", action: "serialize", otherNodeId: noah.id },
    ]);
  });
  it("an exact repeat of a failed action → serialize; a plan with the same signature → warn", () => {
    const failedRun = node({ agentId: "noah", verb: "EDIT", signature: "s1", outcome: "failed" });
    const run = node({ agentId: "ash", verb: "EDIT", signature: "s1" });
    expect(classifyStructural(run, [{ node: failedRun, failedMemory: true }]).judgments[0]?.action).toBe(
      "serialize",
    );
    const plan = node({ agentId: "ash", kind: "intent", verb: "PLAN", signature: "s1" });
    expect(classifyStructural(plan, [{ node: failedRun, failedMemory: true }]).judgments[0]?.action).toBe(
      "warn",
    );
  });
  it("re-running a failed test or command is the normal loop, not stale", () => {
    const failed = node({ agentId: "noah", verb: "TEST", signature: "t1", outcome: "failed" });
    const rerun = node({ agentId: "noah", verb: "TEST", signature: "t1" });
    expect(classifyStructural(rerun, [{ node: failed, failedMemory: true }]).judgments).toEqual([]);
  });
  it("unrelated work → nothing settled", () => {
    const a = node({ agentId: "a", touches: [{ path: "docs/a.md", op: "write" }] });
    const b = node({ agentId: "b", touches: [{ path: "db/m.sql", op: "write" }] });
    const r = classifyStructural(a, [{ node: b, failedMemory: false }]);
    expect(r.judgments).toEqual([]);
    expect(r.unsettled).toEqual([]);
  });
});

describe("renderEvidence", () => {
  it("renders the most severe judgment first with the counterpart's name", () => {
    const text = renderEvidence(
      [
        {
          otherNodeId: "o1",
          relation: "repeats_failure",
          direction: "new_needs_other",
          confidence: 0.95,
          evidence: ["R10: x"],
          action: "warn",
          source: "rule",
          retrievalScore: 1,
          latencyMs: 0,
        },
        {
          otherNodeId: "o2",
          relation: "textual_conflict",
          direction: "none",
          confidence: 0.95,
          evidence: ["R2: both create db/schema/users.ts", "retrieved: both mutate"],
          action: "serialize",
          source: "rule",
          retrievalScore: 1,
          latencyMs: 0,
        },
        {
          otherNodeId: "o3",
          relation: "independent",
          direction: "none",
          confidence: 0.5,
          evidence: [],
          action: "ignore",
          source: "fallback",
          retrievalScore: 1,
          latencyMs: 0,
        },
      ],
      (j) => ({
        name: j.otherNodeId === "o2" ? "noah" : "ash",
        active: true,
        text:
          j.otherNodeId === "o2" ? "EDIT db.users db/schema/users.ts" : "EDIT api.cors src/server.ts → FAIL",
      }),
    );
    const lines = text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "[little-brother] conflict · both create db/schema/users.ts · noah (agent active): EDIT db.users db/schema/users.ts. Not a stop: keep your change out of their lines (add it beside theirs, e.g. as a new function) and retry now, or let theirs land first.",
    );
    expect(lines[1]).toContain("stale · already failed for ash: EDIT api.cors src/server.ts → FAIL");
  });
});
