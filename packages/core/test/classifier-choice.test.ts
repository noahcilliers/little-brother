import { describe, expect, it } from "vitest";
import { CLASSIFIER_CHOICES, classifierChoiceOf, classifierPlan } from "../src/classify/classifier-choice";

describe("classifier choice as first pass + escalation", () => {
  it("round-trips every stored choice through its two steps", () => {
    for (const c of CLASSIFIER_CHOICES) expect(classifierChoiceOf(classifierPlan(c))).toBe(c);
  });
  it("names the combinations", () => {
    expect(classifierChoiceOf({ pairModel: true, judge: "gemini" })).toBe("model+gemini");
    expect(classifierChoiceOf({ pairModel: false, judge: "claude" })).toBe("claude");
    expect(classifierChoiceOf({ pairModel: false, judge: "none" })).toBe("rules");
  });
});
