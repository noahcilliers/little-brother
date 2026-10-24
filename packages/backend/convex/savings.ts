import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Estimated tokens a catch spared, stored as `classifications.tokensSaved` and always shown as an estimate:
 * - duplicate: what the owner's original task cost (the work the duplicate would have redone)
 * - stale (repeats_failure): what the failed trajectory behind the lesson cost
 * - conflict that blocked or serialized, once resolved: what the superseded task cost when it was overruled
 *   (the loser's work built on the wrong contract); unresolved conflicts and ordering waits have no estimate
 * Undefined until the transcripts behind it have reported tokens (at the owning agent's Stop).
 */
async function taskTokens(ctx: QueryCtx, n: Doc<"nodes"> | null): Promise<number | undefined> {
  if (!n) return undefined;
  const task = n.taskId ? await ctx.db.get(n.taskId) : null;
  return task?.tokens ?? n.tokens;
}

/** The lesson's failed path: its trajectory's abandoned tasks, else every action up to the last failure. */
async function failedTrajectoryTokens(ctx: QueryCtx, lesson: Doc<"nodes">): Promise<number | undefined> {
  const intentId = lesson.parentId;
  if (!intentId) return undefined;
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_agent", (q) => q.eq("agentId", lesson.agentId))
    .order("desc")
    .take(100);
  const abandoned = tasks.filter((t) => t.goalId === intentId && t.status === "abandoned" && t.tokens);
  if (abandoned.length) return abandoned.reduce((s, t) => s + (t.tokens ?? 0), 0);
  const actions = (
    await ctx.db
      .query("nodes")
      .withIndex("by_agent", (q) => q.eq("agentId", lesson.agentId).lte("at", lesson.at))
      .order("desc")
      .take(300)
  ).filter((n) => n.parentId === intentId && n.kind === "action");
  const lastFail = actions.find((n) => n.outcome === "failed");
  if (!lastFail) return undefined;
  const total = actions.filter((n) => n.at <= lastFail.at).reduce((s, n) => s + (n.tokens ?? 0), 0);
  return total || undefined;
}

export async function savingsFor(ctx: QueryCtx, c: Doc<"classifications">): Promise<number | undefined> {
  const against = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
  if (c.relation === "repeats_failure") {
    if (against?.kind === "knowledge") return failedTrajectoryTokens(ctx, against);
    return taskTokens(ctx, against);
  }
  if (c.type === "duplicate") return taskTokens(ctx, against);
  if (
    c.type === "conflict" &&
    (c.action === "block" || c.action === "serialize") &&
    c.status === "resolved"
  ) {
    const next = await ctx.db.get(c.nodeId);
    const lose = [next, against].find((n) => n?.outcome === "superseded") ?? null;
    return taskTokens(ctx, lose);
  }
  return undefined;
}

export async function refreshSavings(ctx: MutationCtx, c: Doc<"classifications">): Promise<void> {
  const value = await savingsFor(ctx, c);
  const tokensSaved = value && value > 0 ? Math.round(value) : undefined;
  if (tokensSaved !== c.tokensSaved) await ctx.db.patch(c._id, { tokensSaved });
}

/** Re-estimates every catch on either side of these nodes (tokens arrive after the catch, at Stop). */
export async function refreshSavingsFor(ctx: MutationCtx, nodeIds: Id<"nodes">[]): Promise<void> {
  const seen = new Set<Id<"classifications">>();
  for (const nodeId of nodeIds.slice(0, 150)) {
    const rows = [
      ...(await ctx.db
        .query("classifications")
        .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
        .collect()),
      ...(await ctx.db
        .query("classifications")
        .withIndex("by_against", (q) => q.eq("againstNodeId", nodeId))
        .collect()),
    ];
    for (const c of rows) {
      if (seen.has(c._id)) continue;
      seen.add(c._id);
      await refreshSavings(ctx, c);
    }
  }
}
