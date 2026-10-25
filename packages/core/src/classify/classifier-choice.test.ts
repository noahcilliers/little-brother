import { describe, expect, it } from "vitest";
import { classifierPlan } from "./classifier-choice";

describe("classifierPlan", () => {
  it("defaults to our model with Gemini for the uncertain rest", () => {
    expect(classifierPlan(undefined)).toEqual({ pairModel: true, judge: "gemini" });
  });
  it("maps every choice", () => {
    expect(classifierPlan("claude")).toEqual({ pairModel: false, judge: "claude" });
    expect(classifierPlan("rules")).toEqual({ pairModel: false, judge: "none" });
    expect(classifierPlan("model")).toEqual({ pairModel: true, judge: "none" });
  });
});
