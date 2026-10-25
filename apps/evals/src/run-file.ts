import { z } from "zod";

// The parts of a run's run.json (run-case.ts) that export-pairs.ts reads: the score and the backend
// snapshot, whose rows carry both nodes in full since evals:snapshot added them.

const StoredNode = z.object({
  _id: z.string(),
  agentId: z.string(),
  kind: z.enum(["intent", "action", "knowledge"]),
  verb: z.string(),
  text: z.string(),
  topic: z.string().optional(),
  files: z.array(z.string()),
  touches: z.array(
    z.object({
      path: z.string(),
      symbol: z.string().optional(),
      op: z.string(),
      lines: z.array(z.number()).optional(),
      generated: z.boolean().optional(),
    }),
  ),
  references: z.array(z.string()),
  outcome: z.enum(["open", "succeeded", "failed", "superseded"]),
  signature: z.string().optional(),
  baseRev: z.string().optional(),
  landed: z.enum(["committed", "pushed", "merged"]).optional(),
  preview: z.string().optional(),
  consumes: z.array(z.string()).optional(),
  at: z.number(),
});

export const Row = z.object({
  id: z.string(),
  type: z.string(),
  relation: z.string(),
  action: z.string(),
  reason: z.string(),
  source: z.enum(["rule", "pair_model", "llm", "fallback"]),
  agents: z.array(z.string()),
  confidence: z.number(),
  evidence: z.array(z.string()),
  nodeKind: z.enum(["intent", "action", "knowledge"]),
  nodeText: z.string(),
  againstText: z.string().nullable(),
  latencyMs: z.number(),
  at: z.number(),
  retrievalScore: z.number().optional(),
  direction: z.enum(["new_needs_other", "other_needs_new", "none"]).optional(),
  pair: z
    .object({ next: StoredNode, other: StoredNode.nullable(), evidence: z.array(z.string()) })
    .optional(),
});

export const RunFile = z.object({
  caseId: z.string(),
  variant: z.string(),
  arm: z.string().optional(),
  run: z.number(),
  code: z.string().optional(),
  error: z.string().optional(),
  score: z.object({
    control: z.boolean(),
    expectations: z.array(
      z.object({
        agents: z.array(z.string()),
        type: z.string(),
        relation: z.string().optional(),
        outcome: z.string(),
        materialized: z.boolean(),
      }),
    ),
  }),
  snapshot: z
    .object({ classifications: z.array(Row) })
    .nullable()
    .optional(),
});
export type RunFile = z.infer<typeof RunFile>;
export type Row = z.infer<typeof Row>;
