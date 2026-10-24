import { describe, expect, it } from "vitest";
import { FEATURE_NAMES } from "../src/classify/features";
import {
  goldFromOutcome,
  type LabelledPair,
  LabelledPairSchema,
  labelPair,
  negativeRelation,
  reasonsFromEvidence,
  trainingTarget,
} from "../src/classify/pair-dataset";
import { replay, replayMarkdown } from "../src/classify/replay";
import type { Relation } from "../src/classify/types";
import { node, pair } from "./classify-fixtures";
import { constantModel, zeros } from "./pair-model-fixtures";

const withFeature = (name: string) => zeros().map((_, i) => (FEATURE_NAMES[i] === name ? 1 : 0));

describe("labels", () => {
  it("turns feedback and git outcomes into gold labels, feedback first", () => {
    const f = withFeature("path_jaccard");
    expect(goldFromOutcome({ relation: "duplicate", feedback: "confirmed" }, f)).toEqual({
      relation: "duplicate",
      origin: "feedback",
    });
    expect(
      goldFromOutcome({ relation: "duplicate", feedback: "false_positive", gitStatus: "confirmed" }, f),
    ).toEqual({
      relation: "overlap_compatible",
      origin: "feedback",
    });
    expect(goldFromOutcome({ relation: "semantic_conflict", gitStatus: "clean" }, zeros())).toEqual({
      relation: "independent",
      origin: "git",
    });
    // A clean merge says nothing about duplicated work.
    expect(goldFromOutcome({ relation: "duplicate", gitStatus: "clean" }, f)).toBeNull();
    expect(goldFromOutcome({ relation: "independent", gitStatus: "missed" }, f)?.relation).toBe(
      "textual_conflict",
    );
    expect(goldFromOutcome({ relation: "duplicate", feedback: "ignored" }, f)).toBeNull();
  });

  it("weights gold over teacher labels and never learns from fallbacks", () => {
    const base = labelPair({ id: "x", group: "g", pair: pair(node(), node({ agentId: "b" })) });
    const teacher = { relation: "duplicate" as const, direction: "none" as const, confidence: 0.8 };
    expect(trainingTarget({ ...base, teacher: { ...teacher, source: "llm" } })).toEqual({
      relation: "duplicate",
      weight: 0.3,
    });
    expect(trainingTarget({ ...base, teacher: { ...teacher, source: "fallback" } })).toBeNull();
    expect(trainingTarget({ ...base, gold: { relation: "independent", origin: "eval" } })).toEqual({
      relation: "independent",
      weight: 1,
    });
    expect(negativeRelation(zeros())).toBe("independent");
  });

  it("recomputes the rule verdict and round-trips through the schema", () => {
    const a = node({ touches: [{ path: "db/users.ts", op: "create" }] });
    const b = node({ agentId: "b", touches: [{ path: "db/users.ts", op: "create" }] });
    const row = labelPair({ id: "c1", group: "s1", pair: pair(a, b) });
    expect(row.rule).toMatchObject({ relation: "textual_conflict", ruleId: "R2" });
    expect(LabelledPairSchema.parse(JSON.parse(JSON.stringify(row)))).toEqual(row);
    expect(reasonsFromEvidence(["R2: x", "retrieved: both mutate db/users.ts"])).toEqual([
      "both mutate db/users.ts",
    ]);
  });
});

describe("replay", () => {
  const row = (over: Partial<LabelledPair>): LabelledPair => ({
    v: 1,
    id: "r",
    group: "g",
    featureVersion: 1,
    features: zeros(),
    rule: null,
    teacher: null,
    judge: null,
    gold: null,
    synthetic: true,
    ...over,
  });
  const gold = (relation: Relation) => ({ relation, origin: "synthetic" as const });

  it("compares rules, model, cascade and judge-on-every-pair on the same gold pairs", () => {
    const rows = [
      row({
        rule: { relation: "textual_conflict", direction: "none", ruleId: "R2" },
        gold: gold("textual_conflict"),
      }),
      row({
        judge: { relation: "semantic_conflict", confidence: 0.9, latencyMs: 6000 },
        gold: gold("semantic_conflict"),
      }),
      row({ judge: { relation: "duplicate", confidence: 0.9, latencyMs: 8000 }, gold: gold("independent") }),
    ];
    // Always "independent" with high confidence: settles every pair it sees.
    const model = constantModel([6, 0], ["independent", "duplicate"]);
    const r = replay(rows, model, { rulesMs: 0, modelMs: 1, judgeMs: 7000 });
    const by = Object.fromEntries(r.scores.map((s) => [s.architecture, s]));
    expect(r.labels).toBe("gold");
    expect(by.rules_only?.recall).toBeCloseTo(0.5);
    expect(by.cascade?.judgeCallsPerPair).toBe(0);
    expect(by.llm_every_pair).toMatchObject({ judgeCallsPerPair: 1, precision: 1, recall: 1, imputed: 1 });
    expect(by.llm_every_pair?.latencyMsPerPair).toBeCloseTo((7000 + 6000 + 8000) / 3);
    expect(replayMarkdown(r, "t")).toContain("| cascade |");
  });
});
