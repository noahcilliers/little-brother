import { describe, expect, it } from "vitest";
import { estimateTokens, hookDecision, injectedText } from "../src/hook-timing";
import { context, deny } from "../src/hooks";

describe("injectedText", () => {
  it("counts a deny reason, which the model reads as the tool result", () => {
    expect(injectedText(deny("[little-brother] duplicate"))).toBe("[little-brother] duplicate");
  });

  it("counts additional context", () => {
    expect(injectedText(context("SessionStart", "team digest"))).toBe("team digest");
  });

  it("counts a Stop block reason", () => {
    expect(injectedText({ decision: "block", reason: "run the tests" })).toBe("run the tests");
  });

  it("skips an allow reason, which only the user sees", () => {
    const allow = {
      hookSpecificOutput: { permissionDecision: "allow", permissionDecisionReason: "fine" },
    };
    expect(injectedText(allow)).toBe("");
  });

  it("is empty for no output", () => {
    expect(injectedText(null)).toBe("");
    expect(injectedText("text")).toBe("");
  });
});

describe("hookDecision", () => {
  it("reads the PreToolUse decision", () => {
    expect(hookDecision(deny("x"))).toBe("deny");
    expect(hookDecision(context("PostToolUse", "x"))).toBeUndefined();
    expect(hookDecision(null)).toBeUndefined();
  });
});

describe("estimateTokens", () => {
  it("uses four characters per token", () => {
    expect(estimateTokens(400)).toBe(100);
    expect(estimateTokens(0)).toBe(0);
  });
});
