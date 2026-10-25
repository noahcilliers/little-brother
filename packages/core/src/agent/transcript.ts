import type { ChatTurn } from "./chat";

// `lb agent` writes its transcript in Claude Code's JSONL shape so the connector's transcript readers
// (`transcriptTokens`, `transcriptUsage`) count its tokens per message and per tool call unchanged.

export function promptEntry(text: string, sessionId: string): Record<string, unknown> {
  return { type: "user", sessionId, message: { role: "user", content: text } };
}

/** Prompt tokens served from cache map to Claude's cache reads, which new-token counts leave out. */
export function assistantEntry(turn: ChatTurn, sessionId: string, model: string): Record<string, unknown> {
  const content: Record<string, unknown>[] = [];
  if (turn.text) content.push({ type: "text", text: turn.text });
  for (const c of turn.toolCalls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
  return {
    type: "assistant",
    sessionId,
    message: {
      id: turn.id,
      role: "assistant",
      model,
      content,
      usage: {
        input_tokens: turn.usage.input,
        output_tokens: turn.usage.output,
        cache_read_input_tokens: turn.usage.cached,
      },
    },
  };
}

export function toolResultEntry(
  callId: string,
  text: string,
  isError: boolean,
  sessionId: string,
): Record<string, unknown> {
  return {
    type: "user",
    sessionId,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: callId, content: text, is_error: isError }],
    },
  };
}
