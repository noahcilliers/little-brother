import { type AgentEvent, parseAgentEvent } from "@lb/core";

/**
 * `lb agent`'s JSONL events rewritten as the Claude Code stream-json lines `applyLine` reads, so touched files,
 * first edits, Little Brother messages, usage and cost come out of one parser whichever agent ran.
 */
export function claudeLineFor(e: AgentEvent): string | null {
  switch (e.type) {
    case "start":
      return JSON.stringify({ type: "system", subtype: "init", session_id: e.sessionId });
    case "tool_call":
      return JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", id: e.id, name: e.name, input: e.input }] },
      });
    case "tool_result":
      return JSON.stringify({
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: e.id, is_error: !e.ok, content: e.text }] },
      });
    case "usage":
      return JSON.stringify({
        type: "assistant",
        message: {
          id: e.id,
          usage: {
            input_tokens: e.turn.input,
            output_tokens: e.turn.output,
            cache_read_input_tokens: e.turn.cached,
          },
          content: [],
        },
      });
    case "final":
      return JSON.stringify({
        type: "result",
        total_cost_usd: e.costUsd,
        num_turns: e.turns,
        is_error: e.reason === "error",
        result: e.text,
      });
    default:
      return null;
  }
}

/** One stdout line of `lb agent` as a Claude stream line, or null for lines the log doesn't need. */
export function translateLbLine(raw: string): string | null {
  const e = parseAgentEvent(raw);
  return e ? claudeLineFor(e) : null;
}
