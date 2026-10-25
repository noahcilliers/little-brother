/** A tool's result: `text` is what the model reads, `response` is Claude Code's tool_response for the hooks. */
export type ToolOutcome = { ok: boolean; text: string; response: unknown };
