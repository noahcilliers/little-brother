import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { agentBySession } from "./agents";
import { memberByToken } from "./auth";

type Action = Doc<"inbox">["action"];
const URGENT: Action[] = ["serialize", "block"];

export async function queuedItems(ctx: QueryCtx, agentId: Id<"agents">, actions?: Action[]) {
  const items = await ctx.db
    .query("inbox")
    .withIndex("by_agent_state", (q) => q.eq("agentId", agentId).eq("state", "queued"))
    .collect();
  return actions ? items.filter((i) => actions.includes(i.action)) : items;
}

/** Items the agent has seen or not but never acknowledged, whose classification is still live. */
export async function unackedUrgent(ctx: QueryCtx, agentId: Id<"agents">): Promise<Doc<"inbox">[]> {
  const out: Doc<"inbox">[] = [];
  for (const state of ["queued", "delivered"] as const) {
    const items = await ctx.db
      .query("inbox")
      .withIndex("by_agent_state", (q) => q.eq("agentId", agentId).eq("state", state))
      .collect();
    for (const item of items) {
      if (!URGENT.includes(item.action)) continue;
      const c = await ctx.db.get(item.classificationId);
      if (c?.status === "open") out.push(item);
    }
  }
  return out;
}

export async function markDeliveredIds(ctx: MutationCtx, ids: Id<"inbox">[]): Promise<void> {
  for (const id of ids) {
    const item = await ctx.db.get(id);
    if (item?.state === "queued") await ctx.db.patch(id, { state: "delivered" });
  }
}

/** Channel push feed for `lb mcp`: urgent items not yet delivered by any path. */
export const watch = query({
  args: { token: v.string(), claudeSessionId: v.string() },
  handler: async (ctx, { token, claudeSessionId }) => {
    const member = await memberByToken(ctx, token);
    if (!member) return [];
    const agent = await agentBySession(ctx, claudeSessionId);
    if (!agent || agent.memberId !== member._id) return [];
    const items = await queuedItems(ctx, agent._id, URGENT);
    return Promise.all(
      items.map(async (i) => {
        const c = await ctx.db.get(i.classificationId);
        return { id: i._id as string, text: i.text, action: i.action, kind: c?.type ?? "conflict" };
      }),
    );
  },
});

export const markDelivered = mutation({
  args: { token: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, { token, ids }) => {
    const member = await memberByToken(ctx, token);
    if (!member) return null;
    const owned: Id<"inbox">[] = [];
    for (const raw of ids) {
      const id = ctx.db.normalizeId("inbox", raw);
      const item = id ? await ctx.db.get(id) : null;
      const agent = item ? await ctx.db.get(item.agentId) : null;
      if (id && agent?.memberId === member._id) owned.push(id);
    }
    await markDeliveredIds(ctx, owned);
    return null;
  },
});
