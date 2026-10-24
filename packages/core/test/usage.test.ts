import { describe, expect, it } from "vitest";
import { transcriptUsage } from "../src/usage";

const assistant = (id: string, usage: Record<string, number>, content: unknown[]) => ({
  type: "assistant",
  message: { id, usage, content },
});
const toolUse = (id: string) => ({ type: "tool_use", id, name: "Edit", input: {} });
const prompt = (text: string) => ({ type: "user", message: { role: "user", content: text } });
const toolResult = (id: string) => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
});

describe("transcriptUsage", () => {
  it("splits a message's new tokens over its tool calls, counting repeated usage once", () => {
    const usage = { input_tokens: 10, cache_creation_input_tokens: 90, cache_read_input_tokens: 50_000, output_tokens: 100 };
    const entries = [
      prompt("build auth"),
      // Claude Code logs one entry per content block, each repeating the message's usage.
      assistant("msg_1", usage, [{ type: "text", text: "Reading both files." }]),
      assistant("msg_1", usage, [toolUse("tu_a")]),
      assistant("msg_1", usage, [toolUse("tu_b")]),
      toolResult("tu_a"),
      toolResult("tu_b"),
      assistant("msg_2", { input_tokens: 5, cache_creation_input_tokens: 1000, output_tokens: 300 }, [toolUse("tu_c")]),
    ];
    const u = transcriptUsage(entries);
    expect(u.toolTokens).toEqual({ tu_a: 100, tu_b: 100, tu_c: 1305 });
    expect(u.turnTokens).toBe(200 + 1305);
  });

  it("totals only the latest turn and skips junk", () => {
    const u = transcriptUsage([
      assistant("m1", { output_tokens: 50 }, [toolUse("t1")]),
      prompt("next"),
      null,
      "garbage",
      { type: "assistant" },
      assistant("m2", { output_tokens: 7, input_tokens: -3 }, []),
    ]);
    expect(u.toolTokens).toEqual({ t1: 50 });
    expect(u.turnTokens).toBe(7);
  });

  it("keeps the most recent tool calls when capped", () => {
    const entries = ["a", "b", "c"].map((id, i) => assistant(`m${i}`, { output_tokens: 10 }, [toolUse(id)]));
    expect(Object.keys(transcriptUsage(entries, 2).toolTokens)).toEqual(["b", "c"]);
  });
});
