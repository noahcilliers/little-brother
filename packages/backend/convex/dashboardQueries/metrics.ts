import type { Doc, Id } from "../_generated/dataModel";
import type { Ctx } from "./shared";

const RECENT_VERDICTS = 2000;

// Tokens spent on the trajectory a catch protected against: everything the agent logged from that intent until its next one.
async function trajectoryTokens(ctx: Ctx, root: Doc<"nodes">) {
  const later = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", root.agentId).gt("at", root.at))
    .take(200);
  const end = later.find((n) => n.kind === "intent")?.at ?? Number.POSITIVE_INFINITY;
  const events = await ctx.db
    .query("events")
    .withIndex("by_agent_time", (q) => q.eq("agentId", root.agentId).gte("at", root.at).lt("at", end))
    .take(500);
  return events.reduce((sum, e) => sum + (e.tokens ?? 0), 0);
}

export async function metrics(ctx: Ctx) {
  const verdicts = (await ctx.db.query("classifications").order("desc").take(RECENT_VERDICTS)).filter(
    (c) => c.type !== "normal",
  );
  // Git-found misses never fired live, so they are not catches; they are what recall is measured against.
  const catches = verdicts.filter((c) => c.status !== "dismissed" && c.gitStatus !== "missed");
  const confirmed = verdicts.filter((c) => c.feedback === "confirmed").length;
  const falsePositive = verdicts.filter((c) => c.feedback === "false_positive").length;
  const missedLive = verdicts.filter((c) => c.gitStatus === "missed").length;
  const gitConfirmed = verdicts.filter((c) => c.gitStatus === "confirmed").length;
  const credited = new Set<Id<"nodes">>();
  let tokensSaved = 0;
  for (const c of catches.slice(0, 50)) {
    if (c.type === "conflict" || !c.againstNodeId) continue;
    const against = await ctx.db.get(c.againstNodeId);
    if (!against) continue;
    const root = against.parentId ? await ctx.db.get(against.parentId) : against;
    if (!root || credited.has(root._id)) continue;
    credited.add(root._id);
    tokensSaved += await trajectoryTokens(ctx, root);
  }
  const active = await ctx.db
    .query("agents")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(100);
  return {
    catches: catches.length,
    byType: {
      conflict: catches.filter((c) => c.type === "conflict").length,
      duplicate: catches.filter((c) => c.type === "duplicate").length,
      stale: catches.filter((c) => c.type === "stale").length,
    },
    tokensSaved,
    precision: confirmed + falsePositive > 0 ? confirmed / (confirmed + falsePositive) : null,
    confirmed,
    falsePositive,
    missedLive,
    gitConfirmed,
    activeAgents: active.length,
  };
}
