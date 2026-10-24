import { z } from "zod";

/** Contract 7 — MCP tool arguments. Results are short text. */
export const McpArgs = {
  status: z.object({}),
  inbox: z.object({}),
  ack: z.object({
    itemId: z.string(),
    outcome: z.enum(["acked", "applied", "rejected"]),
    note: z.string().optional(),
  }),
  post_knowledge: z.object({
    fact: z.string().max(500),
    files: z.array(z.string()).default([]),
    topic: z.string().optional(),
  }),
  post_decision: z.object({ topic: z.string(), value: z.string(), rationale: z.string().max(500) }),
  report_failure: z.object({
    tried: z.string().max(300),
    why: z.string().max(300),
    worked: z.string().max(300).optional(),
  }),
  ask: z.object({ question: z.string().max(500), to: z.string().optional() }),
  answer: z.object({ questionId: z.string(), body: z.string().max(1000) }),
};
