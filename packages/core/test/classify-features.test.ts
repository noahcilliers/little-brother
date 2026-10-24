import { describe, expect, it } from "vitest";
import { FEATURE_NAMES, featureMap, pairFeatures } from "../src/classify/features";
import { ruleDirection } from "../src/classify/pair-direction";
import { applyRules } from "../src/classify/pipeline";
import type { CandidatePair } from "../src/classify/types";
import { node, pair } from "./classify-fixtures";
import { medianMs } from "./pair-model-fixtures";

const features = (p: CandidatePair) => featureMap(pairFeatures(p, applyRules(p).hints));

describe("pairFeatures", () => {
  it("returns one finite number per named feature, with unique names", () => {
    const v = pairFeatures(pair(node(), node({ agentId: "b" })), []);
    expect(v).toHaveLength(FEATURE_NAMES.length);
    expect(new Set(FEATURE_NAMES).size).toBe(FEATURE_NAMES.length);
    expect(v.every(Number.isFinite)).toBe(true);
  });

  it("sees two creates of one file and the shared path", () => {
    const a = node({ touches: [{ path: "db/schema/users.ts", op: "create" }] });
    const b = node({ agentId: "b", touches: [{ path: "db/schema/users.ts", op: "create" }] });
    const f = features(pair(a, b));
    expect(f.create_same_path).toBe(1);
    expect(f.path_jaccard).toBe(1);
    expect(f.shared_mutated_paths).toBeCloseTo(1 / 3);
  });

  it("separates overlapping from disjoint line ranges", () => {
    const at = (lines: [number, number]) => [{ path: "src/a.ts", op: "write" as const, lines }];
    const a = node({ touches: at([1, 10]) });
    expect(features(pair(a, node({ agentId: "b", touches: at([5, 12]) }))).line_overlap).toBe(1);
    const far = features(pair(a, node({ agentId: "b", touches: at([40, 50]) })));
    expect([far.line_overlap, far.line_disjoint, far.hint_r8]).toEqual([0, 1, 1]);
  });

  it("flags a signature change against a caller, and derives the caller as the side that must adapt", () => {
    const changer = node({
      touches: [
        {
          path: "src/auth/issue-token.ts",
          symbol: "src/auth/issue-token.ts::issueToken",
          op: "signature_change",
        },
      ],
    });
    const caller = node({ agentId: "b", references: ["src/auth/issue-token.ts::issueToken"] });
    const p = pair(caller, changer);
    expect(features(p).signature_change_vs_call).toBe(1);
    expect(features(p).other_mutates_next_ref).toBe(1);
    expect(ruleDirection(p, "semantic_conflict")).toBe("new_needs_other");
    expect(ruleDirection(pair(changer, caller), "semantic_conflict")).toBe("other_needs_new");
  });

  it("reads intent similarity from the retrieval reason and spots opposed plans", () => {
    const a = node({
      kind: "intent",
      verb: "PLAN",
      text: "PLAN implement auth with JWT bearer tokens, no cookies",
      topic: "auth.mechanism",
    });
    const b = node({
      kind: "intent",
      verb: "PLAN",
      agentId: "b",
      text: "PLAN implement auth with a session cookie instead of JWT",
      topic: "auth.mechanism",
    });
    const p: CandidatePair = {
      ...pair(a, b),
      reasons: ["same topic auth.mechanism", "similar intent (0.84)"],
    };
    const f = features(p);
    expect(f.embedding_similarity).toBeCloseTo(0.84);
    expect(f.both_intent).toBe(1);
    expect(f.intent_text_cosine).toBeGreaterThan(0.3);
    expect(f.opposed_actions).toBe(1);
    expect(f.reason_same_topic).toBe(1);
  });

  it("marks failure memory and exact signature repeats", () => {
    const lesson = node({
      kind: "knowledge",
      verb: "LEARN",
      outcome: "succeeded",
      signature: "s1",
      text: "LEARN api.cors: tried EDIT → FAIL",
    });
    const f = features(pair(node({ signature: "s1" }), lesson, true));
    expect([f.failed_memory, f.other_failed, f.signature_match]).toEqual([1, 1, 1]);
  });

  it("is fast enough for the hot path", () => {
    const a = node({
      touches: [{ path: "src/a.ts", symbol: "src/a.ts::f", op: "write", lines: [1, 9] }],
      references: ["src/b.ts::g"],
    });
    const b = node({
      agentId: "b",
      touches: [{ path: "src/a.ts", symbol: "src/a.ts::f", op: "write", lines: [3, 4] }],
    });
    const p = pair(a, b);
    expect(medianMs(() => pairFeatures(p, []))).toBeLessThan(2);
  });
});
