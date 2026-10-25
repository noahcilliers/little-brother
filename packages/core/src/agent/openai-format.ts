import { z } from "zod";
import type { ChatRequest, ChatTurn, ToolCall } from "./chat";
import { textToolCalls } from "./text-tool-calls";

// OpenAI-compatible /v1/chat/completions (Ollama, LM Studio, vLLM, OpenAI itself): request body and response
// parsing, kept pure so the provider is just a fetch.

export function openAIBody(model: string, req: ChatRequest, maxTokens: number): Record<string, unknown> {
  const messages: Record<string, unknown>[] = [{ role: "system", content: req.system }];
  for (const m of req.messages) {
    if (m.role === "user") messages.push({ role: "user", content: m.text });
    else if (m.role === "tool") messages.push({ role: "tool", tool_call_id: m.callId, content: m.text });
    else
      messages.push({
        role: "assistant",
        content: m.text || null,
        ...(m.toolCalls.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: "function",
                function: {
                  name: c.name,
                  arguments: typeof c.args === "string" ? c.args : JSON.stringify(c.args),
                },
              })),
            }
          : {}),
      });
  }
  return {
    model,
    messages,
    tools: req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: "auto",
    max_tokens: maxTokens,
    temperature: 0.2,
  };
}

const Response = z.object({
  id: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().nullish(),
                function: z.object({ name: z.string(), arguments: z.unknown().optional() }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      prompt_tokens_details: z.object({ cached_tokens: z.number().optional() }).nullish(),
    })
    .nullish(),
});

/** Arguments arrive as a JSON string (sometimes an object); a string that doesn't parse is kept for the error. */
function args(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Throws on a body that isn't a chat completion; tool calls written as text are recovered. */
export function parseOpenAIResponse(body: unknown, fallbackId: string, known: Set<string>): ChatTurn {
  const r = Response.parse(body);
  const id = r.id || fallbackId;
  const msg = r.choices[0]?.message;
  let text = msg?.content ?? "";
  let toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map((c, i) => ({
    id: c.id || `${id}_${i}`,
    name: c.function.name,
    args: args(c.function.arguments),
  }));
  if (!toolCalls.length) {
    toolCalls = textToolCalls(text, known, id);
    if (toolCalls.length) text = "";
  }
  const prompt = r.usage?.prompt_tokens ?? 0;
  const cached = Math.min(prompt, r.usage?.prompt_tokens_details?.cached_tokens ?? 0);
  return {
    id,
    text,
    toolCalls,
    usage: { input: prompt - cached, output: r.usage?.completion_tokens ?? 0, cached },
  };
}
