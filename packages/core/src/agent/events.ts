import { z } from "zod";

/** What `lb agent` prints to stdout, one JSON object per line. The eval harness parses it with this schema. */
const Tokens = z.object({ input: z.number(), output: z.number(), cached: z.number() });

export const AgentEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start"),
    sessionId: z.string(),
    provider: z.string(),
    model: z.string(),
    cwd: z.string(),
    hooks: z.boolean(),
  }),
  z.object({ type: z.literal("turn"), n: z.number() }),
  z.object({ type: z.literal("assistant"), text: z.string() }),
  z.object({ type: z.literal("tool_call"), id: z.string(), name: z.string(), input: z.unknown() }),
  z.object({
    type: z.literal("tool_result"),
    id: z.string(),
    name: z.string(),
    ok: z.boolean(),
    /** What the model reads, capped; deny reasons and appended Little Brother context included. */
    text: z.string(),
  }),
  z.object({ type: z.literal("lb_context"), hook: z.string(), text: z.string() }),
  z.object({ type: z.literal("lb_deny"), id: z.string(), name: z.string(), reason: z.string() }),
  z.object({ type: z.literal("lb_stop_block"), reason: z.string() }),
  z.object({
    type: z.literal("usage"),
    /** Provider response id: one per model call. */
    id: z.string(),
    turn: Tokens,
    total: Tokens,
    costUsd: z.number(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({
    type: z.literal("final"),
    reason: z.enum(["done", "max_turns", "budget", "error"]),
    text: z.string(),
    turns: z.number(),
    tokens: Tokens,
    costUsd: z.number(),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEvent>;

/** Parses one stdout line; anything else (a stray log line) is null. */
export function parseAgentEvent(line: string): AgentEvent | null {
  try {
    const parsed = AgentEvent.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
