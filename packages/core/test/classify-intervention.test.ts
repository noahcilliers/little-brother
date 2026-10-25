import { describe, expect, it } from "vitest";
import { interventionAction } from "../src/classify/catch";
import { otherSideAction } from "../src/classify/decide";
import { type Counterpart, renderEvidence } from "../src/classify/evidence";
import type { Judgment } from "../src/classify/types";

const rename = {
  relation: "semantic_conflict" as const,
  action: "serialize" as const,
  confidence: 0.85,
  evidence: ["R4: base36_to_int is renamed on one side but referenced on the other"],
};

const judgment = (direction: Judgment["direction"]): Judgment => ({
  otherNodeId: "n2",
  relation: "semantic_conflict",
  direction,
  action: "serialize",
  confidence: 0.85,
  evidence: rename.evidence,
  source: "rule",
});
const them = (name: string): Counterpart => ({ name, active: true, text: "EDIT django/utils/http.py → OK" });

describe("interface changes: the changer keeps the old interface working", () => {
  it("denies the changer once, then lets it through", () => {
    expect(interventionAction({ ...rename, direction: "other_needs_new" })).toBe("serialize");
    expect(interventionAction({ ...rename, direction: "other_needs_new", repeat: true })).toBe("warn");
  });

  it("only tells the caller, whose branch doesn't have the new interface", () => {
    expect(interventionAction({ ...rename, direction: "new_needs_other" })).toBe("warn");
  });

  it("holds a changer found later at Stop, and only tells a caller found later", () => {
    expect(otherSideAction(judgment("new_needs_other"), { kind: "action", failedMemory: false })).toBe(
      "block",
    );
    expect(otherSideAction(judgment("other_needs_new"), { kind: "action", failedMemory: false })).toBe(
      "warn",
    );
  });

  it("tells each side what to do", () => {
    const toChanger = renderEvidence([judgment("other_needs_new")], () => them("ash"));
    expect(toChanger).toContain("ash's code calls the old interface on their branch");
    expect(toChanger).toContain("Keep the old interface working too");
    const toCaller = renderEvidence([judgment("new_needs_other")], () => them("noah"));
    expect(toCaller).toContain("keep using the current one here");
  });
});
