import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

export type LogEntry = {
  teamId: Id<"teams">;
  sessionId?: Id<"sessions">;
  memberId?: Id<"members">;
  level: Doc<"serverLog">["level"];
  kind: string;
  text: string;
};

const TEXT_MAX = 600;

export async function writeLog(ctx: MutationCtx, e: LogEntry): Promise<void> {
  await ctx.db.insert("serverLog", { ...e, text: e.text.slice(0, TEXT_MAX), at: Date.now() });
}

/** Events with no session (an outdated connector, an unknown code) go to every room the member is in. */
export async function logForMember(
  ctx: MutationCtx,
  memberId: Id<"members">,
  e: Omit<LogEntry, "teamId" | "memberId">,
): Promise<void> {
  const rooms = await ctx.db
    .query("roomMembers")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .take(20);
  for (const r of rooms) await writeLog(ctx, { ...e, teamId: r.teamId, memberId });
}

/** True when this member already has a `kind` entry within `withinMs`, so noisy warnings stay one line. */
export async function loggedRecently(
  ctx: MutationCtx,
  memberId: Id<"members">,
  kind: string,
  withinMs: number,
): Promise<boolean> {
  const recent = await ctx.db
    .query("serverLog")
    .withIndex("by_member", (q) => q.eq("memberId", memberId).gte("at", Date.now() - withinMs))
    .take(50);
  return recent.some((r) => r.kind === kind);
}

/** The classifier runs in actions; this writes its per-node summary into the node's session log. */
export const recordForNode = internalMutation({
  args: {
    nodeId: v.id("nodes"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    kind: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { nodeId, ...e }) => {
    const node = await ctx.db.get(nodeId);
    const agent = node ? await ctx.db.get(node.agentId) : null;
    if (!agent?.teamId) return;
    await writeLog(ctx, { ...e, teamId: agent.teamId, sessionId: agent.sessionId, memberId: agent.memberId });
  },
});
