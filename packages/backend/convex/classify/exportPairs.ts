import {
  type CandidatePair,
  goldFromOutcome,
  isFailureMemory,
  type LabelledPair,
  labelPair,
  pairMeta,
  type Relation,
  RELATIONS,
  reasonsFromEvidence,
  toClassifiedNode,
} from "@lb/core";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { stored } from "./load";

// Training export for the pair model: one labelled row per stored classification with both nodes present.
// Features are recomputed from the nodes as they are now (outcomes may have moved on since the verdict).

const isRelation = (r: string): r is Relation => (RELATIONS as readonly string[]).includes(r);

async function groupOf(ctx: QueryCtx, n: Doc<"nodes">): Promise<string> {
  const agent = await ctx.db.get(n.agentId);
  return String(agent?.sessionId ?? n.teamId ?? agent?.teamId ?? "none");
}

async function rowFor(ctx: QueryCtx, c: Doc<"classifications">): Promise<LabelledPair | null> {
  if (!c.againstNodeId || !isRelation(c.relation)) return null;
  const relation = c.relation;
  const [n, o] = [await ctx.db.get(c.nodeId), await ctx.db.get(c.againstNodeId)];
  if (!n || !o) return null;
  const next = toClassifiedNode(stored(n));
  const other = toClassifiedNode(stored(o));
  const pair: CandidatePair = {
    next,
    other,
    retrievalScore: c.retrievalScore,
    reasons: reasonsFromEvidence(c.evidence),
    failedMemory: isFailureMemory(o),
  };
  return labelPair({
    id: c._id,
    group: await groupOf(ctx, n),
    pair,
    teacher: { relation, direction: c.direction, confidence: c.confidence, source: c.source },
    judge: c.source === "llm" ? { relation, confidence: c.confidence, latencyMs: c.latencyMs } : null,
    goldFrom: (features) =>
      goldFromOutcome(
        { relation, ...(c.feedback ? { feedback: c.feedback } : {}), ...(c.gitStatus ? { gitStatus: c.gitStatus } : {}) },
        features,
      ),
    meta: { ...pairMeta(next, other), at: c.at },
  });
}

/**
 * One page of JSONL lines. Loop with the returned cursor until isDone, e.g. with
 * scripts/classifier/export-deployment.ts, which wraps `npx convex run classify/exportPairs:page`.
 */
export const page = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const res = await ctx.db.query("classifications").order("asc").paginate(paginationOpts);
    const lines: string[] = [];
    for (const c of res.page) {
      const row = await rowFor(ctx, c);
      if (row && (row.gold || row.teacher?.source === "llm" || row.teacher?.source === "rule"))
        lines.push(JSON.stringify(row));
    }
    return { lines, continueCursor: res.continueCursor, isDone: res.isDone };
  },
});
