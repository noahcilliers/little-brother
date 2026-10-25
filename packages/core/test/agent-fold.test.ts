import { describe, expect, it } from "vitest";
import { parseAgentEvent } from "../src/agent/events";
import {
  blockedResult,
  denyReason,
  hookContext,
  openingPrompt,
  stopBlockReason,
  withContext,
} from "../src/agent/fold";
import { costUsd, parsePrice, priceFor } from "../src/agent/pricing";
import { assistantEntry, promptEntry, toolResultEntry } from "../src/agent/transcript";
import { blockStop, context, deny } from "../src/hooks";
import { transcriptUsage } from "../src/usage";

describe("hook output folding", () => {
  it("reads the three hook outputs Claude Code acts on", () => {
    expect(denyReason(deny("[little-brother] noah owns users"))).toBe("[little-brother] noah owns users");
    expect(denyReason(context("PostToolUse", "note"))).toBeUndefined();
    expect(denyReason(null)).toBeUndefined();
    expect(hookContext(context("SessionStart", " team digest "))).toBe("team digest");
    expect(hookContext(null)).toBe("");
    expect(stopBlockReason(blockStop("run the tests"))).toBe("run the tests");
    expect(stopBlockReason(context("PostToolUse", "x"))).toBeUndefined();
  });

  it("turns a deny into the tool result and appends context", () => {
    expect(blockedResult("dup")).toMatch(/^Blocked by Little Brother: dup\n/);
    expect(withContext("ok", "")).toBe("ok");
    expect(withContext("ok", "heads up")).toBe(
      "ok\n\n<little-brother-context>\nheads up\n</little-brother-context>",
    );
    expect(openingPrompt("do it", ["", "digest"])).toBe(
      "<little-brother-context>\ndigest\n</little-brother-context>\n\ndo it",
    );
    expect(openingPrompt("do it", [])).toBe("do it");
  });
});

describe("transcript entries", () => {
  it("are read by the connector's transcript usage parser per tool call and per turn", () => {
    const turn = {
      id: "m1",
      text: "",
      toolCalls: [
        { id: "t1", name: "Read", args: {} },
        { id: "t2", name: "Read", args: {} },
      ],
      usage: { input: 100, output: 20, cached: 500 },
    };
    const entries = [
      promptEntry("go", "s"),
      assistantEntry(turn, "s", "m"),
      toolResultEntry("t1", "x", false, "s"),
      toolResultEntry("t2", "y", false, "s"),
    ];
    // Cache reads are excluded from new tokens; the tool results aren't mistaken for a new prompt.
    expect(transcriptUsage(entries)).toEqual({ toolTokens: { t1: 60, t2: 60 }, turnTokens: 120 });
  });
});

describe("pricing", () => {
  it("prices by longest prefix, local servers at zero, and parses overrides", () => {
    expect(priceFor("gemini-2.5-flash-lite").input).toBe(0.1);
    expect(priceFor("gemini-2.5-flash").input).toBe(0.3);
    expect(priceFor("gemini-3.8-flash")).toEqual(priceFor("gemini-3.5-flash"));
    expect(priceFor("gemini-9-flash-lite")).toEqual(priceFor("gemini-3.5-flash-lite"));
    expect(priceFor("mystery-model").input).toBe(0);
    expect(priceFor("qwen2.5-coder:7b", { baseUrl: "http://localhost:11434/v1" }).output).toBe(0);
    expect(parsePrice("0.3/2.5")).toEqual({ input: 0.3, output: 2.5, cached: 0.03 });
    expect(parsePrice("cheap")).toBeNull();
    expect(
      costUsd({ input: 1_000_000, output: 1_000_000, cached: 0 }, { input: 1, output: 2, cached: 0 }),
    ).toBe(3);
  });
});

describe("agent events", () => {
  it("parses event lines and ignores anything else", () => {
    expect(parseAgentEvent('{"type":"turn","n":1}')).toEqual({ type: "turn", n: 1 });
    expect(parseAgentEvent("lb: warming up")).toBeNull();
    expect(parseAgentEvent('{"type":"nope"}')).toBeNull();
  });
});
