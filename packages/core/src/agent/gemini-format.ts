import { z } from "zod";
import type { ChatMessage, ChatTurn, ToolCall, ToolSchema } from "./chat";

// Gemini generateContent: contents and tool declarations out, a turn back. Plain objects in the SDK's shapes,
// so this stays pure and the provider only makes the call.

type Part = Record<string, unknown>;

/** Ids we made up for calls Gemini sent without one; they never go back to the API. */
const SYNTHETIC = "lbcall_";
const idField = (id: string) => (id.startsWith(SYNTHETIC) ? {} : { id });
export type GeminiContent = { role: "user" | "model"; parts: Part[] };

/**
 * Every tool result of a turn goes back in one user content, in call order. A model turn is replayed from
 * its raw content when we have it: Gemini's thought signatures must come back untouched.
 */
export function geminiContents(messages: ChatMessage[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", parts: [{ text: m.text }] });
    else if (m.role === "assistant") {
      const raw = RawContent.safeParse(m.raw);
      if (raw.success) {
        out.push({ role: "model", parts: raw.data.parts });
        continue;
      }
      const parts: Part[] = m.text ? [{ text: m.text }] : [];
      for (const c of m.toolCalls)
        parts.push({
          functionCall: { ...idField(c.id), name: c.name, args: typeof c.args === "object" ? c.args : {} },
        });
      out.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });
    } else {
      const part = { functionResponse: { ...idField(m.callId), name: m.name, response: { output: m.text } } };
      const last = out.at(-1);
      if (last?.role === "user" && last.parts.every((p) => "functionResponse" in p)) last.parts.push(part);
      else out.push({ role: "user", parts: [part] });
    }
  }
  return out;
}

export const geminiTools = (tools: ToolSchema[]) => [
  {
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: t.parameters,
    })),
  },
];

const RawContent = z.object({ role: z.string().optional(), parts: z.array(z.record(z.unknown())).min(1) });
const Response = z.object({
  responseId: z.string().optional(),
  candidates: z
    .array(z.object({ content: RawContent.optional(), finishReason: z.string().optional() }))
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      thoughtsTokenCount: z.number().optional(),
      cachedContentTokenCount: z.number().optional(),
    })
    .optional(),
});
const Call = z.object({ id: z.string().optional(), name: z.string(), args: z.unknown().optional() });

/** Thinking tokens are billed as output, so they count as output. */
export function parseGeminiResponse(body: unknown, fallbackId: string): ChatTurn & { finishReason?: string } {
  const r = Response.parse(body);
  const id = r.responseId || fallbackId;
  const cand = r.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const p of parts) {
    if (typeof p.text === "string" && p.thought !== true) texts.push(p.text);
    const call = Call.safeParse(p.functionCall);
    if (call.success)
      toolCalls.push({
        id: call.data.id || `${SYNTHETIC}${id}_${toolCalls.length}`,
        name: call.data.name,
        args: call.data.args ?? {},
      });
  }
  const u = r.usageMetadata;
  const prompt = u?.promptTokenCount ?? 0;
  const cached = Math.min(prompt, u?.cachedContentTokenCount ?? 0);
  return {
    id,
    text: texts.join(""),
    toolCalls,
    usage: {
      input: prompt - cached,
      output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
      cached,
    },
    ...(cand?.content ? { raw: cand.content } : {}),
    ...(cand?.finishReason ? { finishReason: cand.finishReason } : {}),
  };
}
