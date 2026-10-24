"use node";

import Anthropic from "@anthropic-ai/sdk";
import { type Distiller, JUDGE_SYSTEM, type Judge, judgePrompt, parseJudgeOutput } from "@lb/core";
import { judgeSchema } from "./schema";

const MODEL = process.env.CLAUDE_JUDGE_MODEL ?? "claude-opus-5-5";

/**
 * SDK 0.65 predates typed `output_config`, so the request is built as a widened object: the API accepts
 * `output_config.effort` and `output_config.format` (JSON schema) and the SDK forwards the body as-is.
 * Forced tool_choice is rejected on this model, which is why structured output goes through the format.
 */
type Body = Anthropic.MessageCreateParamsNonStreaming & {
  output_config: { effort: "low"; format?: { type: "json_schema"; schema: Record<string, unknown> } };
};

async function ask(client: Anthropic, system: string, prompt: string, json: boolean): Promise<string | null> {
  const body: Body = {
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      effort: "low",
      ...(json ? { format: { type: "json_schema", schema: judgeSchema() } } : {}),
    },
  };
  const res = await client.messages.create(body);
  if (res.stop_reason !== "end_turn") return null;
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return text || null;
}

export function claudeJudge(apiKey: string): Judge & Distiller {
  const client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
  return {
    async judge(pair, hints, examples) {
      const raw = await ask(client, JUDGE_SYSTEM, judgePrompt(pair, hints, examples), true);
      return raw ? parseJudgeOutput(raw, pair, hints) : null;
    },
    distill(prompt) {
      return ask(client, "You write terse engineering post-mortems.", prompt, false);
    },
  };
}
