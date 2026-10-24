import type { Id } from "../_generated/dataModel";
import {
  agentWithBranch,
  type Ctx,
  handleCache,
  takeoverOf,
  takeoverText,
  verdictsForNode,
  worstVerdict,
} from "./shared";

export async function agents(ctx: Ctx) {
  const rows = await ctx.db.query("agents").order("desc").take(50);
  const out = await Promise.all(
    rows.map(async (a) => {
      const intent = a.intentId ? await ctx.db.get(a.intentId) : null;
      return { ...(await agentWithBranch(ctx, a)), intent: intent?.text };
    }),
  );
  const order = { active: 0, idle: 1, offline: 2 } as const;
  return out.sort((a, b) => order[a.status] - order[b.status] || b.lastSeenAt - a.lastSeenAt);
}

export async function agentStream(ctx: Ctx, agentId: Id<"agents">) {
  const agent = await ctx.db.get(agentId);
  if (!agent) return null;
  const handle = handleCache(ctx);
  const events = (
    await ctx.db
      .query("events")
      .withIndex("by_agent_time", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(80)
  ).reverse();
  const lines = await Promise.all(
    events.map(async (e) => {
      const node = e.nodeId ? await ctx.db.get(e.nodeId) : null;
      const own = e.nodeId ? worstVerdict(await verdictsForNode(ctx, e.nodeId)) : undefined;
      const takeover = own ? await takeoverOf(ctx, own, handle) : undefined;
      return {
        _id: e._id,
        at: e.at,
        hook: e.hook,
        tool: e.tool,
        source: e.source,
        files: e.files,
        summary: e.summary,
        signature: node?.text,
        outcome: node?.outcome,
        landed: node?.landed,
        verdict: own
          ? {
              type: own.type,
              action: own.action,
              reason: own.reason,
              relation: own.relation,
              gitStatus: own.gitStatus,
              takeover: takeover ? takeoverText(takeover) : undefined,
            }
          : undefined,
      };
    }),
  );
  const inbox = await ctx.db
    .query("inbox")
    .withIndex("by_agent_state", (q) => q.eq("agentId", agentId))
    .take(50);
  const items = await Promise.all(
    inbox.map(async (i) => {
      const c = await ctx.db.get(i.classificationId);
      const takeover = c ? await takeoverOf(ctx, c, handle) : undefined;
      return {
        _id: i._id,
        text: i.text,
        action: i.action,
        state: i.state,
        attempts: i.attempts,
        at: i.at,
        gitStatus: c?.gitStatus,
        // The owner whose claim was taken gets this item; label it so the stream reads as the hand-off.
        takeover: takeover ? takeoverText(takeover) : undefined,
      };
    }),
  );
  return {
    agent: await agentWithBranch(ctx, agent),
    lines,
    inbox: items.sort((a, b) => a.at - b.at),
  };
}
