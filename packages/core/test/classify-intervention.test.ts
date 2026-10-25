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

describe("interface changes: each side is stopped once with its own fix", () => {
  it("denies the changer once, then lets it through", () => {
    expect(interventionAction({ ...rename, direction: "other_needs_new" })).toBe("serialize");
    expect(interventionAction({ ...rename, direction: "other_needs_new", repeat: true })).toBe("warn");
  });

  it("denies the caller once too, to write against the new interface", () => {
    expect(interventionAction({ ...rename, direction: "new_needs_other" })).toBe("serialize");
    expect(interventionAction({ ...rename, direction: "new_needs_other", repeat: true })).toBe("warn");
  });

  it("holds whichever side was found later at Stop", () => {
    expect(otherSideAction(judgment("new_needs_other"), { kind: "action", failedMemory: false })).toBe(
      "block",
    );
    expect(otherSideAction(judgment("other_needs_new"), { kind: "action", failedMemory: false })).toBe(
      "block",
    );
  });

  it("tells each side what to do", () => {
    const toChanger = renderEvidence([judgment("other_needs_new")], () => them("ash"));
    expect(toChanger).toContain("ash's code calls the old interface on their branch");
    expect(toChanger).toContain("Keep the old interface working too");
    const toCaller = renderEvidence([judgment("new_needs_other")], () => them("noah"));
    expect(toCaller).toContain("write this against their new interface");
  });
});
