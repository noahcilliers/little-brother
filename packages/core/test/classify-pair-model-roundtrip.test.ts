import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { predict } from "../src/classify/pair-model";
import { parsePairModel } from "../src/classify/pair-model-schema";
import { RELATIONS } from "../src/classify/types";

// Written by `train.py --roundtrip` from the SYNTHETIC fixture (scripts/classifier/fixtures/synthetic.jsonl):
// both estimator kinds, with the probabilities Python's reference predict computed for sample rows.
type Fixture = {
  models: { model: unknown; cases: { features: number[]; probs: Record<string, number> }[] }[];
};
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/pair-model-roundtrip.json", import.meta.url), "utf8"),
) as Fixture;

describe("Python-exported models predict the same in TypeScript", () => {
  for (const { model, cases } of fixture.models) {
    const parsed = parsePairModel(model);
    const name = parsed.ok ? parsed.model.estimator.kind : "invalid";
    it(`${name}: every probability within 1e-6`, () => {
      if (!parsed.ok) throw new Error(parsed.error);
      expect(cases.length).toBeGreaterThan(5);
      for (const c of cases) {
        const p = predict(parsed.model, c.features);
        for (const r of RELATIONS) expect(Math.abs(p.probs[r] - (c.probs[r] ?? 0))).toBeLessThan(1e-6);
      }
    });
  }
});
