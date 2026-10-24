import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertViewer } from "./access";
import { board as boardView } from "./dashboardQueries/board";

// Read model for apps/web: team members only (or anyone in local open mode); every read is bounded.
// The handler lives in dashboardQueries/ so each piece stays small; this file only fixes the public API name.

export const board = query({
  args: {},
  handler: async (ctx) => {
    await assertViewer(ctx);
    return boardView(ctx);
  },
});

/** Where a decision's inbox items are: queued, or delivered into each agent's session. */
export const delivery = query({
  args: { classificationId: v.id("classifications") },
  handler: async (ctx, { classificationId }) => {
    await assertViewer(ctx);
    const items = await ctx.db
      .query("inbox")
      .withIndex("by_classification", (q) => q.eq("classificationId", classificationId))
      .take(20);
    const out = [];
    for (const i of items) {
      const agent = await ctx.db.get(i.agentId);
      const member = agent ? await ctx.db.get(agent.memberId) : null;
      out.push({ id: i._id, handle: member?.handle ?? "agent", state: i.state, action: i.action, at: i.at });
    }
    return out;
  },
});
