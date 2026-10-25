import { describe, expect, it } from "vitest";
import { needsPerson } from "../src/classify/needs-person";

const row = {
  type: "conflict",
  relation: "textual_conflict",
  action: "serialize",
  status: "open",
  evidence: ["R1: both edit src/a.ts"],
};

describe("which catches wait for a person", () => {
  it("an open enforcing catch nobody has a claim on", () => {
    expect(needsPerson(row)).toBe(true);
    expect(needsPerson({ ...row, winnerAgentId: "a1" })).toBe(false);
    expect(needsPerson({ ...row, status: "resolved" })).toBe(false);
  });

  it("two contradicting goals, even when the agents were only warned", () => {
    expect(needsPerson({ ...row, relation: "intent_contradiction", action: "warn" })).toBe(true);
    expect(needsPerson({ ...row, relation: "overlap_compatible", action: "warn" })).toBe(false);
  });

  it("not an interface clash, whose fix each side is told", () => {
    expect(
      needsPerson({
        ...row,
        relation: "semantic_conflict",
        evidence: ["R5: signature of pay changes on one side while the other calls it"],
      }),
    ).toBe(false);
  });
});
