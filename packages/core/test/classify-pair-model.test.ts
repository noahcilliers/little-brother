import { describe, expect, it } from "vitest";
import { FEATURE_NAMES, FEATURE_VERSION } from "../src/classify/features";
import { predict, settles, settleThreshold } from "../src/classify/pair-model";
import { parsePairModel } from "../src/classify/pair-model-schema";
import { settleByPairModel } from "../src/classify/pair-tier";
import { node, pair } from "./classify-fixtures";
import { constantModel, zeros } from "./pair-model-fixtures";

const F = FEATURE_NAMES.length;

describe("predict", () => {
  it("softmaxes logistic scores over the model's classes and zeroes the rest", () => {
    const m = constantModel([0, Math.log(3)], ["independent", "duplicate"]);
    const p = predict(m, zeros());
    expect(p.relation).toBe("duplicate");
    expect(p.confidence).toBeCloseTo(0.75, 9);
    expect(p.margin).toBeCloseTo(0.5, 9);
    expect(p.probs.semantic_conflict).toBe(0);
  });

  it("walks trees, comparing in float32, and adds leaves to the class's base score", () => {
    const parsed = parsePairModel({
      format: "lb-pair-model",
      version: "t",
      featureVersion: FEATURE_VERSION,
      featureNames: [...FEATURE_NAMES],
      classes: ["independent", "textual_conflict"],
      estimator: {
        kind: "gbdt",
        base: [0, 0],
        trees: [{ c: 1, nodes: [{ f: 0, t: 0.5, l: 1, r: 2 }, { v: -2 }, { v: 2 }] }],
      },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const hi = zeros();
    hi[0] = 1;
    expect(predict(parsed.model, hi).relation).toBe("textual_conflict");
    expect(predict(parsed.model, zeros()).probs.textual_conflict).toBeCloseTo(1 / (1 + Math.exp(2)), 9);
  });

  it("applies per-class isotonic calibration and renormalizes", () => {
    const iso = { kind: "isotonic" as const, x: [0, 1], y: [0, 1] };
    const flat = { kind: "isotonic" as const, x: [0, 1], y: [0.5, 0.5] };
    const m = constantModel([0, 0], ["independent", "duplicate"], { calibration: [iso, flat] });
    // Both raw probs are 0.5; calibrated 0.5 and 0.5 → unchanged after renormalization.
    expect(predict(m, zeros()).probs.duplicate).toBeCloseTo(0.5, 9);
    const skew = constantModel([0, Math.log(3)], ["independent", "duplicate"], { calibration: [iso, flat] });
    expect(predict(skew, zeros()).probs.duplicate).toBeCloseTo(0.5 / 0.75, 9);
  });

  it("runs well under a millisecond for an exported-size tree ensemble", () => {
    const tree = (c: number) => ({
      c,
      nodes: [
        { f: c % F, t: 0.5, l: 1, r: 2 },
        { f: (c + 1) % F, t: 0.2, l: 3, r: 4 },
        { f: (c + 2) % F, t: 0.7, l: 5, r: 6 },
        { v: 0.1 },
        { v: -0.1 },
        { v: 0.2 },
        { v: -0.2 },
      ],
    });
    const parsed = parsePairModel({
      format: "lb-pair-model",
      version: "big",
      featureVersion: FEATURE_VERSION,
      featureNames: [...FEATURE_NAMES],
      classes: ["independent", "overlap_compatible", "duplicate", "textual_conflict", "semantic_conflict", "intent_contradiction", "ordering_dependency", "repeats_failure"],
      estimator: { kind: "gbdt", base: new Array(8).fill(0), trees: Array.from({ length: 800 }, (_, i) => tree(i % 8)) },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const x = zeros().map((_, i) => (i % 3) / 2);
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) predict(parsed.model, x);
    expect((performance.now() - t0) / 500).toBeLessThan(1);
  });
});

describe("parsePairModel", () => {
  it("refuses mismatched shapes and models trained on other features", () => {
    const m = constantModel([0, 0], ["independent", "duplicate"]);
    expect(parsePairModel({ ...m, classes: ["independent"] }).ok).toBe(false);
    const short = { ...m, estimator: { ...m.estimator, bias: [0] } };
    expect(parsePairModel(short).ok).toBe(false);
    const expectNames = { featureVersion: FEATURE_VERSION, featureNames: FEATURE_NAMES };
    expect(parsePairModel(m, expectNames).ok).toBe(true);
    expect(parsePairModel({ ...m, featureVersion: FEATURE_VERSION + 1 }, expectNames).ok).toBe(false);
    expect(parsePairModel("nope").ok).toBe(false);
  });
});

describe("gating", () => {
  it("uses 0.9 for blocking relations, 0.75 otherwise, unless the model stores its own", () => {
    const m = constantModel([0, 0], ["independent", "duplicate"], { thresholds: { duplicate: 0.6 } });
    expect(settleThreshold(m, "semantic_conflict")).toBe(0.9);
    expect(settleThreshold(m, "independent")).toBe(0.75);
    expect(settleThreshold(m, "duplicate")).toBe(0.6);
  });

  it("settles confident pairs and sends uncertain ones to the judge", () => {
    const sure = constantModel([0, 5], ["independent", "duplicate"]);
    const unsure = constantModel([0, 0.4], ["independent", "duplicate"]);
    expect(settles(sure, predict(sure, zeros()))).toBe(true);
    expect(settles(unsure, predict(unsure, zeros()))).toBe(false);
    const a = node({ kind: "intent", verb: "PLAN", text: "PLAN add retry to the http client" });
    const b = node({ kind: "intent", verb: "PLAN", agentId: "b", text: "PLAN add retries to the http client" });
    const u = [{ pair: { ...pair(a, b), reasons: ["similar intent (0.93)"] }, hints: [] }];
    const settled = settleByPairModel(sure, u, { nextKind: "action" });
    expect(settled.rest).toHaveLength(0);
    expect(settled.judgments[0]).toMatchObject({ relation: "duplicate", source: "pair_model", action: "warn" });
    expect(settleByPairModel(unsure, u, { nextKind: "action" }).rest).toEqual(u);
  });

  it("caps a model verdict at warn when the pair is linked only by wording", () => {
    const m = constantModel([0, 6], ["independent", "intent_contradiction"]);
    const a = node({ kind: "action" });
    const b = node({ agentId: "b" });
    const [j] = settleByPairModel(m, [{ pair: { ...pair(a, b), reasons: ["similar intent (0.9)"] }, hints: [] }], { nextKind: "action" }).judgments;
    expect(j?.action).toBe("warn");
    const [k] = settleByPairModel(m, [{ pair: { ...pair(a, b), reasons: ["both mutate src/a.ts"] }, hints: [] }], { nextKind: "action" }).judgments;
    expect(k?.action).toBe("block");
  });
});

describe("domain", () => {
  it("sends pairs of kinds the model never trained on to the judge", () => {
    const m = constantModel([0, 6], ["independent", "duplicate"], { domain: { kindPairs: ["action>action"], failedMemory: false } });
    const plans = { pair: pair(node({ kind: "intent", verb: "PLAN" }), node({ kind: "intent", verb: "PLAN", agentId: "b" })), hints: [] };
    const edits = { pair: pair(node(), node({ agentId: "b" })), hints: [] };
    const r = settleByPairModel(m, [plans, edits], { nextKind: "action" });
    expect(r.rest).toEqual([plans]);
    expect(r.judgments).toHaveLength(1);
  });
});
