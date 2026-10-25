import { describe, expect, it } from "vitest";
import { r6CreateVsReference } from "../src/classify/rules/r6-create-vs-reference";
import type { CandidatePair, ClassifiedNode } from "../src/classify/types";

const node = (over: Partial<ClassifiedNode>): ClassifiedNode =>
  ({
    id: "n",
    agentId: "a",
    kind: "action",
    verb: "EDIT",
    text: "",
    files: [],
    touches: [],
    references: [],
    outcome: "open",
    at: 0,
    ...over,
  }) as ClassifiedNode;

describe("R6 by name", () => {
  it("warns when a teammate's new function is imported from a guessed path", () => {
    const creator = node({
      id: "c",
      touches: [
        { path: "src/auth/require-user.ts", op: "create", symbol: "src/auth/require-user.ts::requireAdmin" },
      ],
    });
    const user = node({ id: "u", references: ["src/auth/require-admin.ts::requireAdmin"] });
    const r = r6CreateVsReference.check({
      next: user,
      other: creator,
      failedMemory: false,
      reasons: [],
      retrievalScore: 1,
    } as unknown as CandidatePair);
    expect(r && "judgment" in r ? r.judgment.relation : null).toBe("ordering_dependency");
    expect(r && "judgment" in r ? r.judgment.confidence : 0).toBeLessThan(0.7);
  });

  it("ignores generic names", () => {
    const creator = node({ id: "c", touches: [{ path: "a.ts", op: "create", symbol: "a.ts::handler" }] });
    const user = node({ id: "u", references: ["b.ts::handler"] });
    expect(
      r6CreateVsReference.check({
        next: user,
        other: creator,
        failedMemory: false,
        reasons: [],
        retrievalScore: 1,
      } as unknown as CandidatePair),
    ).toBeNull();
  });
});
