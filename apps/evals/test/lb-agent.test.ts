import type { AgentEvent } from "@lb/core";
import { describe, expect, it } from "vitest";
import { parseAgentSpec, runnerFor } from "../src/agent-spec";
import { claudeLineFor } from "../src/lb-stream";
import { applyLine, emptyLog, logTokens } from "../src/stream";

describe("--agent", () => {
  it("parses claude, gemini and OpenAI-compatible specs, model ids with colons included", () => {
    expect(parseAgentSpec("claude")).toEqual({ kind: "claude" });
    expect(parseAgentSpec("lb:gemini:gemini-2.5-flash")).toEqual({
      kind: "lb",
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
    expect(parseAgentSpec("lb:openai:qwen2.5-coder:7b@http://localhost:11434/v1")).toEqual({
      kind: "lb",
      provider: "openai",
      model: "qwen2.5-coder:7b",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(parseAgentSpec("lb:openai:qwen2.5-coder:7b")).toMatchObject({
      baseUrl: "http://localhost:11434/v1",
    });
    expect(() => parseAgentSpec("gpt")).toThrow(/--agent must be/);
    expect(() => parseAgentSpec("lb:gemini:x@http://h")).toThrow(/no base URL/);
    expect(runnerFor({ kind: "claude" }, "cli.js")).toEqual({});
  });
});

describe("lb agent stream", () => {
  const events: AgentEvent[] = [
    { type: "start", sessionId: "s1", provider: "gemini", model: "m", cwd: "/w", hooks: true },
    {
      type: "usage",
      id: "r1",
      turn: { input: 100, output: 10, cached: 50 },
      total: { input: 100, output: 10, cached: 50 },
      costUsd: 0.01,
    },
    {
      type: "tool_call",
      id: "c1",
      name: "Edit",
      input: { file_path: "/w/src/db.ts", old_string: "a", new_string: "b" },
    },
    {
      type: "tool_result",
      id: "c1",
      name: "Edit",
      ok: false,
      text: "Blocked by Little Brother: [little-brother] duplicate · noah",
    },
    { type: "tool_call", id: "c2", name: "Write", input: { file_path: "src/new.ts", content: "x" } },
    { type: "tool_result", id: "c2", name: "Write", ok: true, text: "Created src/new.ts" },
    { type: "tool_call", id: "c3", name: "Bash", input: { command: "npm test" } },
    {
      type: "final",
      reason: "done",
      text: "Done.",
      turns: 4,
      tokens: { input: 100, output: 10, cached: 50 },
      costUsd: 0.02,
    },
  ];

  it("folds into the same log a Claude Code stream produces", () => {
    const log = emptyLog();
    const firstEdits = events.map((e) => {
      const line = claudeLineFor(e);
      return line ? applyLine(log, line, "/w", 1) : false;
    });
    expect(firstEdits.filter(Boolean)).toHaveLength(1);
    expect(firstEdits[5]).toBe(true); // the denied edit doesn't count, the created file does
    expect(log.sessionId).toBe("s1");
    expect([...log.touched]).toEqual(["src/db.ts", "src/new.ts"]);
    expect(log.commands).toEqual(["npm test"]);
    expect(log.lbMessages).toEqual(["Blocked by Little Brother: [little-brother] duplicate · noah"]);
    expect(logTokens(log)).toEqual({ input: 100, output: 10, cacheCreation: 0, cacheRead: 50 });
    expect(log).toMatchObject({ finished: true, costUsd: 0.02, turns: 4, resultText: "Done." });
  });

  it("drops events the log has no use for", () => {
    expect(claudeLineFor({ type: "turn", n: 1 })).toBeNull();
    expect(claudeLineFor({ type: "lb_context", hook: "PostToolUse", text: "x" })).toBeNull();
  });
});
