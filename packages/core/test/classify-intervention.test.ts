import { describe, expect, it } from "vitest";
import { interventionAction } from "../src/classify/catch";
import { type Counterpart, renderEvidence } from "../src/classify/evidence";
import type { Judgment } from "../src/classify/types";

const rename = {
  relation: "semantic_conflict" as const,
  action: "serialize" as const,
  confidence: 0.85,
  evidence: ["R4: base36_to_int is renamed on one side but referenced on the other"],
};

describe("interface changes", () => {
  it("deny the caller once, then let it through", () => {
    expect(interventionAction({ ...rename, direction: "new_needs_other" })).toBe("serialize");
    expect(interventionAction({ ...rename, direction: "new_needs_other", repeat: true })).toBe("warn");
  });

  it("only warn the changer while the caller can still hear about it", () => {
    expect(interventionAction({ ...rename, direction: "other_needs_new" })).toBe("warn");
  });

  it("deny the changer once when the caller already finished, since nobody else can keep its call working", () => {
    expect(interventionAction({ ...rename, direction: "other_needs_new", otherFinished: true })).toBe(
      "serialize",
    );
    expect(
      interventionAction({ ...rename, direction: "other_needs_new", otherFinished: true, repeat: true }),
    ).toBe("warn");
  });

  it("tell the changer to keep the old interface working when the caller is done", () => {
    const j: Judgment = {
      otherNodeId: "n2",
      relation: "semantic_conflict",
      direction: "other_needs_new",
      action: "serialize",
      confidence: 0.85,
      evidence: rename.evidence,
      source: "rule",
    };
    const ash: Counterpart = {
      name: "ash",
      active: true,
      finished: true,
      text: "EDIT django/utils/http.py → OK",
    };
    const text = renderEvidence([j], () => ash);
    expect(text).toContain("ash already finished");
    expect(text).toContain("Keep the old interface working too");
  });
});
