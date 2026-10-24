import { describe, expect, it } from "vitest";
import {
  capAction,
  decide,
  dedupe,
  fallbackJudgment,
  otherSideAction,
  type Verdict,
  worstAction,
} from "../src/classify/decide";
import type { Judgment, Relation } from "../src/classify/types";
import { node, pair } from "./classify-fixtures";

function v(relation: Relation, confidence: number, direction: Verdict["direction"] = "none"): Verdict {
  return { otherNodeId: "o", relation, direction, confidence, evidence: [], source: "rule" };
}
const act = { nextKind: "action" as const };

describe("decide policy table", () => {
  it.each([
    ["independent", 0.99, "ignore"],
    ["overlap_compatible", 0.99, "ignore"],
    ["duplicate", 0.7, "warn"],
    ["duplicate", 0.69, "ignore"],
    ["textual_conflict", 0.8, "serialize"],
    ["textual_conflict", 0.79, "warn"],
    ["semantic_conflict", 0.85, "block"],
    ["semantic_conflict", 0.84, "warn"],
    ["intent_contradiction", 0.8, "block"],
    ["intent_contradiction", 0.5, "warn"],
    ["ordering_dependency", 0.7, "serialize"],
    ["ordering_dependency", 0.6, "warn"],
    ["repeats_failure", 0.75, "warn"],
    ["repeats_failure", 0.7, "ignore"],
  ] as const)("%s at %d → %s", (relation, confidence, action) => {
    expect(decide(v(relation, confidence, "new_needs_other"), { retrievalScore: 0.9 }, act).action).toBe(
      action,
    );
  });

  it("serializes only the dependent side of an ordering dependency", () => {
    expect(decide(v("ordering_dependency", 0.8, "other_needs_new"), { retrievalScore: 1 }, act).action).toBe(
      "warn",
    );
  });
  it("serializes an exact repeat of a failing edit or command", () => {
    const j = decide(v("repeats_failure", 0.95), { retrievalScore: 1 }, { ...act, exactRepeat: true });
    expect(j.action).toBe("serialize");
  });
  it("caps intents at serialize", () => {
    expect(decide(v("semantic_conflict", 0.95), { retrievalScore: 1 }, { nextKind: "intent" }).action).toBe(
      "serialize",
    );
  });
  it("uses calibrated thresholds when given", () => {
    const j = decide(
      v("semantic_conflict", 0.86),
      { retrievalScore: 1 },
      { ...act, thresholds: { semantic_conflict: 0.9 } },
    );
    expect(j.action).toBe("warn");
  });
  it("carries retrieval score and latency", () => {
    expect(decide(v("duplicate", 0.9), { retrievalScore: 0.42 }, act, 7)).toMatchObject({
      retrievalScore: 0.42,
      latencyMs: 7,
    });
  });
});

describe("other side", () => {
  const j = (
    relation: Relation,
    action: Judgment["action"],
    direction: Judgment["direction"] = "none",
  ): Judgment => ({
    ...v(relation, 0.9, direction),
    action,
    retrievalScore: 1,
    latencyMs: 0,
  });
  it("never tells the author of a failure about a repeat", () => {
    expect(otherSideAction(j("repeats_failure", "warn"), { kind: "action", failedMemory: true })).toBe(
      "ignore",
    );
  });
  it("does not alert the owner when a duplicate creator is redirected", () => {
    expect(otherSideAction(j("textual_conflict", "serialize"), { kind: "action", failedMemory: false })).toBe(
      "ignore",
    );
  });
  it("serializes the dependent other side of an ordering dependency", () => {
    const k = j("ordering_dependency", "warn", "other_needs_new");
    expect(otherSideAction(k, { kind: "action", failedMemory: false })).toBe("serialize");
  });
  it("blocks both sides of a semantic conflict, capped for intents", () => {
    expect(otherSideAction(j("semantic_conflict", "block"), { kind: "action", failedMemory: false })).toBe(
      "block",
    );
    expect(otherSideAction(j("semantic_conflict", "block"), { kind: "intent", failedMemory: false })).toBe(
      "serialize",
    );
  });
});

describe("fallback, rollup, dedupe", () => {
  it("falls back to overlap_compatible with hints, independent without", () => {
    const p = pair(node(), node({ agentId: "b" }));
    expect(fallbackJudgment(p, [{ rule: "R8", text: "x" }])).toMatchObject({
      relation: "overlap_compatible",
      confidence: 0.3,
      source: "fallback",
      action: "ignore",
    });
    expect(fallbackJudgment(p, [])).toMatchObject({ relation: "independent", confidence: 0.5 });
  });
  it("worst action wins", () => {
    expect(worstAction([])).toBe("ignore");
    expect(worstAction([{ action: "warn" }, { action: "block" }, { action: "serialize" }])).toBe("block");
    expect(capAction("block", "serialize")).toBe("serialize");
    expect(capAction("warn", "serialize")).toBe("warn");
  });
  it("re-alerts only when severity rises for the same open relation", () => {
    const prior = [{ id: "c1", relation: "textual_conflict", action: "warn" as const, status: "open" }];
    expect(dedupe([], { relation: "textual_conflict", action: "warn" })).toEqual({ kind: "insert" });
    expect(dedupe(prior, { relation: "textual_conflict", action: "warn" })).toEqual({
      kind: "skip",
      id: "c1",
    });
    expect(dedupe(prior, { relation: "textual_conflict", action: "serialize" })).toEqual({
      kind: "raise",
      id: "c1",
    });
    expect(dedupe(prior, { relation: "duplicate", action: "warn" })).toEqual({ kind: "insert" });
    expect(
      dedupe([{ id: "c1", relation: "textual_conflict", action: "warn", status: "resolved" }], {
        relation: "textual_conflict",
        action: "warn",
      }),
    ).toEqual({ kind: "insert" });
  });
});
