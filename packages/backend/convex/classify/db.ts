import { exampleLine, type Judgment, lexicalSimilarity, RELATIONS } from "@lb/core";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { classifiedView, loadStructural, loadThresholds, toCandidates } from "./load";
import { ASYNC_SELF, persistJudgments } from "./persist";
import { priorityLoader } from "./priority";

const judgmentV = v.object({
  otherNodeId: v.string(),
  relation: v.union(...RELATIONS.map((r) => v.literal(r))),
  direction: v.union(v.literal("new_needs_other"), v.literal("other_needs_new"), v.literal("none")),
  confidence: v.number(),
  evidence: v.array(v.string()),
  action: v.union(v.literal("ignore"), v.literal("warn"), v.literal("serialize"), v.literal("block")),
  source: v.union(v.literal("rule"), v.literal("pair_model"), v.literal("llm"), v.literal("fallback")),
  retrievalScore: v.number(),
  latencyMs: v.number(),
  type: v.optional(
    v.union(v.literal("conflict"), v.literal("stale"), v.literal("duplicate"), v.literal("normal")),
  ),
  winner: v.optional(v.union(v.literal("next"), v.literal("other"))),
});

/** Everything the async classifier needs that does not require the network. */
export const context = internalQuery({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const next = await ctx.db.get(nodeId);
    if (!next) return null;
    const now = Date.now();
    const priority = priorityLoader(ctx);
    const nodes = await loadStructural(ctx, next, now);
    return {
      view: await classifiedView(next, priority),
      embedded: next.embedding !== undefined,
      structural: await toCandidates(ctx, next, nodes, now, new Map(), priority),
      thresholds: await loadThresholds(ctx),
    };
  },
});

/** Candidates for vector hits, filtered the same way as structural ones. */
export const vectorCandidates = internalQuery({
  args: { nodeId: v.id("nodes"), hits: v.array(v.object({ id: v.id("nodes"), score: v.number() })) },
  handler: async (ctx, { nodeId, hits }) => {
    const next = await ctx.db.get(nodeId);
    if (!next) return [];
    const docs: Doc<"nodes">[] = [];
    for (const h of hits) {
      const d = await ctx.db.get(h.id);
      if (d) docs.push(d);
    }
    return toCandidates(ctx, next, docs, Date.now(), new Map(hits.map((h) => [h.id, h.score])));
  },
});

const LEXICAL_MIN = 0.25;

/** Without an embedder: lessons, failures and open intents that share content words with the new node. */
export const lexicalCandidates = internalQuery({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const next = await ctx.db.get(nodeId);
    if (!next) return [];
    const recent = (outcome: Doc<"nodes">["outcome"]) =>
      ctx.db
        .query("nodes")
        .withIndex("by_outcome", (q) => q.eq("outcome", outcome))
        .order("desc")
        .take(200);
    const pool = [
      ...(await recent("failed")),
      ...(await recent("succeeded")).filter((n) => n.kind === "knowledge"),
      ...(await recent("open")).filter((n) => n.kind === "intent"),
    ];
    const sims = new Map<string, number>();
    const hits: Doc<"nodes">[] = [];
    for (const n of pool) {
      const s = lexicalSimilarity(next.text, n.text);
      if (s >= LEXICAL_MIN && n._id !== next._id) {
        sims.set(n._id, s);
        hits.push(n);
      }
    }
    return toCandidates(ctx, next, hits, Date.now(), sims);
  },
});

/** 3–5 past judgments with human feedback, preferring ones that involve the retrieved nodes. */
export const examples = internalQuery({
  args: { near: v.array(v.id("nodes")) },
  handler: async (ctx, { near }) => {
    const nearSet = new Set<string>(near);
    const rows = [
      ...(await ctx.db
        .query("classifications")
        .withIndex("by_status", (q) => q.eq("status", "resolved"))
        .order("desc")
        .take(50)),
      ...(await ctx.db
        .query("classifications")
        .withIndex("by_status", (q) => q.eq("status", "dismissed"))
        .order("desc")
        .take(50)),
    ].filter((c) => c.feedback === "confirmed" || c.feedback === "false_positive");
    const score = (c: Doc<"classifications">) =>
      Number(nearSet.has(c.nodeId)) + Number(c.againstNodeId !== undefined && nearSet.has(c.againstNodeId));
    rows.sort((a, b) => score(b) - score(a) || b.at - a.at);
    const out: string[] = [];
    for (const c of rows.slice(0, 5)) {
      const n = await ctx.db.get(c.nodeId);
      const o = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
      if (n && o && c.feedback) {
        out.push(
          exampleLine({ nextText: n.text, otherText: o.text, relation: c.relation, feedback: c.feedback }),
        );
      }
    }
    return out;
  },
});

export const storeEmbedding = internalMutation({
  args: { nodeId: v.id("nodes"), embedding: v.array(v.float64()) },
  handler: async (ctx, { nodeId, embedding }) => {
    if (await ctx.db.get(nodeId)) await ctx.db.patch(nodeId, { embedding });
  },
});

export const persist = internalMutation({
  args: { nodeId: v.id("nodes"), judgments: v.array(judgmentV) },
  handler: async (ctx, { nodeId, judgments }) => {
    const next = await ctx.db.get(nodeId);
    if (next) await persistJudgments(ctx, next, judgments satisfies Judgment[], { selfActions: ASYNC_SELF });
  },
});

/** Nodes already classified against this one, in either direction: never pay the judge twice for a pair. */
export const classifiedWith = internalQuery({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const forward = await ctx.db
      .query("classifications")
      .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
      .take(200);
    const reverse = await ctx.db
      .query("classifications")
      .withIndex("by_against", (q) => q.eq("againstNodeId", nodeId))
      .take(200);
    return [
      ...forward.flatMap((c) => (c.againstNodeId ? [c.againstNodeId] : [])),
      ...reverse.map((c) => c.nodeId),
    ];
  },
});
