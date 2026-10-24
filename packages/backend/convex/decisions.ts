import { TopicMap } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { supersede } from "./resolve";

async function ownsTopic(ctx: MutationCtx, agent: Doc<"agents">, topic: string): Promise<boolean> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", `topics:${agent.repo}`))
    .first();
  const map = TopicMap.safeParse(row?.value);
  const member = await ctx.db.get(agent.memberId);
  return map.success && !!member && map.data.topics[topic]?.owner === member.handle;
}

/**
 * A decision posted by the topic's owner settles the open conflicts on that topic, the same way an approval on
 * the dashboard does: the owner's side stands, the other side's step is superseded and its agent is told what
 * to build on. Decisions from non-owners are recorded but settle nothing.
 */
export async function resolveByDecision(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  topic: string,
  value: string,
  decisionId: Id<"nodes">,
): Promise<number> {
  if (!(await ownsTopic(ctx, agent, topic))) return 0;
  const handle = (await ctx.db.get(agent.memberId))?.handle ?? "owner";
  const open = await ctx.db
    .query("classifications")
    .withIndex("by_status", (q) => q.eq("status", "open"))
    .take(200);
  let settled = 0;
  for (const c of open) {
    if (c.type !== "conflict" || !c.againstNodeId) continue;
    const [a, b] = await Promise.all([ctx.db.get(c.nodeId), ctx.db.get(c.againstNodeId)]);
    if (!a || !b || (a.topic !== topic && b.topic !== topic)) continue;
    const lose = a.agentId === agent._id ? b : b.agentId === agent._id ? a : null;
    if (!lose) continue;
    await ctx.db.patch(c._id, {
      status: "resolved",
      feedback: "confirmed",
      resolution: `decided: ${topic} = ${value} by @${handle} (${decisionId})`,
      outcome: "owner_decision",
    });
    await supersede(ctx, lose);
    await ctx.db.insert("inbox", {
      agentId: lose.agentId,
      classificationId: c._id,
      text: `[little-brother] decided · @${handle} (owner) set ${topic} = ${value}. Your step "${lose.text}" is superseded; update it to ${value} before continuing.`,
      action: "warn",
      state: "queued",
      attempts: 0,
      at: Date.now(),
    });
    settled++;
  }
  return settled;
}
