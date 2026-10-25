/**
 * The provider-neutral conversation `lb agent` keeps. Providers translate it to their wire format and back;
 * the loop, the hooks and the transcript only ever see these shapes.
 */

/** `args` is whatever the model produced: an object, or a string when its JSON didn't parse. */
export type ToolCall = { id: string; name: string; args: unknown };

export type ChatMessage =
  | { role: "user"; text: string }
  /** `raw` is the provider's own copy of the turn, replayed verbatim (Gemini's thought signatures live there). */
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; raw?: unknown }
  | { role: "tool"; callId: string; name: string; text: string };

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type ToolSchema = { name: string; description: string; parameters: JsonSchema };

/** `input` excludes `cached`: prompt tokens the provider served from its cache, billed at a discount. */
export type ChatUsage = { input: number; output: number; cached: number };

/** `malformed`: the provider saw a broken tool call it couldn't return; the loop tells the model and goes on. */
export type ChatTurn = {
  id: string;
  text: string;
  toolCalls: ToolCall[];
  usage: ChatUsage;
  raw?: unknown;
  malformed?: string;
};

export type ChatRequest = { system: string; messages: ChatMessage[]; tools: ToolSchema[] };

/** One model behind one provider. `complete` throws on transport errors; the caller retries. */
export interface ChatModel {
  readonly provider: string;
  readonly model: string;
  complete(req: ChatRequest): Promise<ChatTurn>;
}

export const assistantMessage = (turn: ChatTurn): ChatMessage => ({
  role: "assistant",
  text: turn.text,
  toolCalls: turn.toolCalls,
  ...(turn.raw === undefined ? {} : { raw: turn.raw }),
});
