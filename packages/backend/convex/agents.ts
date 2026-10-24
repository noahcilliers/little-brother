import type { IngestEnvelope } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";

const IDLE_AFTER_MS = 5 * 60_000;
const OFFLINE_AFTER_MS = 30 * 60_000;

/** Every hook touches the agent row, so it is created lazily by whichever hook arrives first. */
export async function upsertAgent(
  ctx: MutationCtx,
  memberId: Id<"members">,
  session: IngestEnvelope["session"],
  now: number,
  baseRev?: string,
): Promise<Doc<"agents">> {
  const existing = await agentBySession(ctx, session.claudeSessionId);
  const fields = {
    machine: session.machine,
    repo: session.repo,
    branch: session.branch,
    status: "active" as const,
    lastSeenAt: now,
    ...(baseRev ? { baseRev } : {}),
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { ...existing, ...fields };
  }
  const id = await ctx.db.insert("agents", { memberId, claudeSessionId: session.claudeSessionId, ...fields });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("agent insert vanished");
  return created;
}

export function agentBySession(ctx: QueryCtx, claudeSessionId: string): Promise<Doc<"agents"> | null> {
  return ctx.db
    .query("agents")
    .withIndex("by_session", (q) => q.eq("claudeSessionId", claudeSessionId))
    .first();
}

/** MCP servers can't see the session id reliably, so an unknown id falls back to the member's latest agent. */
export async function resolveAgent(
  ctx: QueryCtx,
  memberId: Id<"members">,
  claudeSessionId: string,
): Promise<Doc<"agents"> | null> {
  if (claudeSessionId) {
    const agent = await agentBySession(ctx, claudeSessionId);
    if (agent && agent.memberId === memberId) return agent;
  }
  return ctx.db
    .query("agents")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .order("desc")
    .first();
}

export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const status of ["active", "idle"] as const) {
      const agents = await ctx.db
        .query("agents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const a of agents) {
        const quiet = now - a.lastSeenAt;
        if (quiet > OFFLINE_AFTER_MS) await ctx.db.patch(a._id, { status: "offline" });
        else if (status === "active" && quiet > IDLE_AFTER_MS) await ctx.db.patch(a._id, { status: "idle" });
      }
    }
  },
});
