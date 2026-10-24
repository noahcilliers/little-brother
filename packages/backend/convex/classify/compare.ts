import type { ComparisonSide } from "@lb/core";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";

const OPEN_SCAN = 100;
const TOPIC_SCAN = 50;
const WORK_LINES = 4;
const ESCALATIONS: ReadonlySet<string> = new Set(["semantic_conflict", "intent_contradiction"]);

async function nameOf(ctx: QueryCtx, agentId: Id<"agents">): Promise<string> {
  const agent = await ctx.db.get(agentId);
  const member = agent ? await ctx.db.get(agent.memberId) : null;
  return member?.handle ?? "another agent";
}

/** The side's own node if it succeeded, plus its other succeeded actions on the conflict's topics. */
function sideWork(node: Doc<"nodes">, onTopics: Doc<"nodes">[]): string[] {
  const done = onTopics.filter(
    (n) =>
      n.agentId === node.agentId && n.kind === "action" && n.outcome === "succeeded" && n._id !== node._id,
  );
  const own = node.outcome === "succeeded" ? [node] : [];
  return [...own, ...done].slice(0, WORK_LINES).map((n) => n.text);
}

/**
 * Open escalations involving this node's agent that have no comparison yet and where both sides now have
 * working code. The comparison is what the owner reads before deciding.
 */
export const pending = internalQuery({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const node = await ctx.db.get(nodeId);
    if (node?.kind !== "action" || node.outcome !== "succeeded") return [];
    const rows = await ctx.db
      .query("classifications")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(OPEN_SCAN);
    const due = rows.filter(
      (c) =>
        c.action === "block" &&
        ESCALATIONS.has(c.relation) &&
        c.comparison === undefined &&
        c.agentIds.length === 2 &&
        c.agentIds.includes(node.agentId),
    );
    const out = [];
    for (const c of due) {
      const a = await ctx.db.get(c.nodeId);
      const b = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
      if (!a || !b) continue;
      const topics = [...new Set([a.topic, b.topic].filter((t): t is string => t !== undefined))];
      const onTopics: Doc<"nodes">[] = [];
      for (const topic of topics) {
        onTopics.push(
          ...(await ctx.db
            .query("nodes")
            .withIndex("by_topic", (q) => q.eq("topic", topic))
            .order("desc")
            .take(TOPIC_SCAN)),
        );
      }
      const sides: [ComparisonSide, ComparisonSide] = [
        { name: await nameOf(ctx, a.agentId), work: sideWork(a, onTopics) },
        { name: await nameOf(ctx, b.agentId), work: sideWork(b, onTopics) },
      ];
      if (sides[0].work.length === 0 || sides[1].work.length === 0) continue;
      const decisions = onTopics
        .filter((n) => n.verb === "DECIDE" && n.outcome !== "superseded")
        .slice(0, 3)
        .map((n) => n.text);
      out.push({ classificationId: c._id, relation: c.relation, reason: c.reason, sides, decisions });
    }
    return out;
  },
});

/** Reserve the single comparison for a classification; false when another run already took it. */
export const claim = internalMutation({
  args: { classificationId: v.id("classifications") },
  handler: async (ctx, { classificationId }) => {
    const c = await ctx.db.get(classificationId);
    if (!c || c.comparison !== undefined) return false;
    await ctx.db.patch(classificationId, { comparison: "" });
    return true;
  },
});

export const store = internalMutation({
  args: { classificationId: v.id("classifications"), comparison: v.string() },
  handler: async (ctx, { classificationId, comparison }) => {
    if (await ctx.db.get(classificationId)) await ctx.db.patch(classificationId, { comparison });
  },
});
