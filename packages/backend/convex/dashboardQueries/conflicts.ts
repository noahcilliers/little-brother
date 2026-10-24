import type { Id } from "../_generated/dataModel";
import { type Ctx, handleCache, type Klass, slimNode, takeoverOf, takeoverText } from "./shared";

async function conflictView(ctx: Ctx, c: Klass) {
  const handle = handleCache(ctx);
  const side = async (id: Id<"nodes"> | undefined) => {
    const n = id ? await ctx.db.get(id) : null;
    return n ? { ...slimNode(n), handle: await handle(n.agentId) } : null;
  };
  const inbox = await ctx.db
    .query("inbox")
    .withIndex("by_classification", (q) => q.eq("classificationId", c._id))
    .take(20);
  const takeover = await takeoverOf(ctx, c, handle);
  return {
    _id: c._id,
    relation: c.relation,
    action: c.action,
    status: c.status,
    reason: c.reason,
    evidence: c.evidence,
    confidence: c.confidence,
    resolution: c.resolution,
    gitStatus: c.gitStatus,
    comparison: c.comparison,
    takeover: takeover ? takeoverText(takeover) : undefined,
    at: c.at,
    a: await side(c.againstNodeId),
    b: await side(c.nodeId),
    delivery: await Promise.all(
      inbox.map(async (i) => ({
        _id: i._id,
        handle: await handle(i.agentId),
        state: i.state,
        action: i.action,
        text: i.text,
      })),
    ),
  };
}

export async function openConflicts(ctx: Ctx) {
  const isConflict = (c: Klass) =>
    c.type === "conflict" && (c.action === "block" || c.action === "serialize");
  const open = (
    await ctx.db
      .query("classifications")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100)
  ).filter(isConflict);
  const resolved = (
    await ctx.db
      .query("classifications")
      .withIndex("by_status", (q) => q.eq("status", "resolved"))
      .order("desc")
      .take(20)
  )
    .filter(isConflict)
    .slice(0, 3);
  return {
    open: await Promise.all(open.slice(0, 10).map((c) => conflictView(ctx, c))),
    recent: await Promise.all(resolved.map((c) => conflictView(ctx, c))),
  };
}
