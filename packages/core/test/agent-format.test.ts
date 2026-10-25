import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/agent/chat";
import { geminiContents, parseGeminiResponse } from "../src/agent/gemini-format";
import { openAIBody, parseOpenAIResponse } from "../src/agent/openai-format";
import { TOOL_SCHEMAS } from "../src/agent/tools";

const convo: ChatMessage[] = [
  { role: "user", text: "fix it" },
  {
    role: "assistant",
    text: "",
    toolCalls: [
      { id: "c1", name: "Read", args: { file_path: "a.ts" } },
      { id: "c2", name: "Read", args: { file_path: "b.ts" } },
    ],
  },
  { role: "tool", callId: "c1", name: "Read", text: "1\tconst a = 1;" },
  { role: "tool", callId: "c2", name: "Read", text: "1\tconst b = 2;" },
];

describe("openai format", () => {
  it("sends tool calls with string arguments and tool results by call id", () => {
    const body = openAIBody("qwen", { system: "sys", messages: convo, tools: TOOL_SCHEMAS }, 4096);
    const messages = body.messages as Record<string, unknown>[];
    expect(messages[0]).toEqual({ role: "system", content: "sys" });
    expect(messages[2]).toMatchObject({
      role: "assistant",
      tool_calls: [
        { id: "c1", type: "function", function: { name: "Read", arguments: '{"file_path":"a.ts"}' } },
        {},
      ],
    });
    expect(messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: "1\tconst a = 1;" });
    expect((body.tools as unknown[]).length).toBe(6);
  });

  it("parses structured calls, keeps unparseable arguments as text, and splits cached tokens", () => {
    const turn = parseOpenAIResponse(
      {
        id: "r1",
        choices: [
          {
            message: {
              content: null,
              tool_calls: [{ id: "x", function: { name: "Bash", arguments: "{bad" } }],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 7, prompt_tokens_details: { cached_tokens: 40 } },
      },
      "fallback",
      new Set(["Bash"]),
    );
    expect(turn).toEqual({
      id: "r1",
      text: "",
      toolCalls: [{ id: "x", name: "Bash", args: "{bad" }],
      usage: { input: 60, output: 7, cached: 40 },
    });
  });

  it("recovers a call a local model wrote as text", () => {
    const turn = parseOpenAIResponse(
      { choices: [{ message: { content: '{"name": "Read", "arguments": {"file_path": "a.ts"}}' } }] },
      "f",
      new Set(["Read"]),
    );
    expect(turn.toolCalls).toEqual([{ id: "f_0", name: "Read", args: { file_path: "a.ts" } }]);
    expect(turn.text).toBe("");
  });
});

describe("gemini format", () => {
  it("groups a turn's tool results into one user content", () => {
    const contents = geminiContents(convo);
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(contents[2]?.parts).toHaveLength(2);
    expect(contents[2]?.parts[0]).toEqual({
      functionResponse: { id: "c1", name: "Read", response: { output: "1\tconst a = 1;" } },
    });
  });

  it("replays a model turn's raw parts (thought signatures) and drops ids it made up", () => {
    const raw = {
      role: "model",
      parts: [{ functionCall: { name: "Read", args: {} }, thoughtSignature: "sig" }],
    };
    const turn = parseGeminiResponse(
      {
        candidates: [{ content: raw, finishReason: "STOP" }],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 5,
          thoughtsTokenCount: 20,
          cachedContentTokenCount: 10,
        },
      },
      "g1",
    );
    expect(turn.usage).toEqual({ input: 40, output: 25, cached: 10 });
    expect(turn.toolCalls[0]?.id).toBe("lbcall_g1_0");
    const back = geminiContents([
      { role: "assistant", text: "", toolCalls: turn.toolCalls, raw: turn.raw },
      { role: "tool", callId: turn.toolCalls[0]?.id ?? "", name: "Read", text: "ok" },
    ]);
    expect(back[0]?.parts[0]).toEqual(raw.parts[0]);
    expect(back[1]?.parts[0]).toEqual({ functionResponse: { name: "Read", response: { output: "ok" } } });
  });

  it("skips thought text", () => {
    const turn = parseGeminiResponse(
      { candidates: [{ content: { parts: [{ text: "hmm", thought: true }, { text: "Done." }] } }] },
      "g",
    );
    expect(turn.text).toBe("Done.");
  });
});
