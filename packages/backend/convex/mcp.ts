import { McpArgs, renderDigest } from "@lb/core";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { resolveAgent } from "./agents";
import { teamDigest } from "./digest";
import { markDeliveredIds } from "./inbox";
import { answer, ask, type Posted, postDecision, postKnowledge, reportFailure } from "./knowledge";
import { sessionAgents } from "./sessionRows";
import { memberByTokenHash } from "./tokenAuth";

type McpResult = { status: 200 | 400 | 401 | 404; text: string };
type Tool = keyof typeof McpArgs;
const isTool = (t: string): t is Tool => t in McpArgs;

async function unacked(ctx: MutationCtx, agentId: Id<"agents">) {
  const out: Doc<"inbox">[] = [];
  for (const state of ["queued", "delivered"] as const) {
    out.push(
      ...(await ctx.db
        .query("inbox")
        .withIndex("by_agent_state", (q) => q.eq("agentId", agentId).eq("state", state))
        .collect()),
    );
  }
  return out;
}

async function inbox(ctx: MutationCtx, agent: Doc<"agents">): Promise<Posted> {
  const items = await unacked(ctx, agent._id);
  await markDeliveredIds(
    ctx,
    items.map((i) => i._id),
  );
  return {
    text:
      renderDigest(
        items.map((i) => ({ id: i._id, text: i.text })),
        20,
      ) || "inbox empty",
  };
}

async function status(ctx: MutationCtx, agent: Doc<"agents">): Promise<Posted> {
  const pending = (await unacked(ctx, agent._id)).length;
  return { text: `${await teamDigest(ctx, agent, false)}\nYour inbox: ${pending} unacked item(s)` };
}

async function ack(ctx: MutationCtx, member: Doc<"members">, raw: unknown): Promise<McpResult> {
  const a = McpArgs.ack.parse(raw);
  const id = ctx.db.normalizeId("inbox", a.itemId);
  const item = id ? await ctx.db.get(id) : null;
  const owner = item ? await ctx.db.get(item.agentId) : null;
  if (!item || owner?.memberId !== member._id) return { status: 404, text: `no inbox item ${a.itemId}` };
  await ctx.db.patch(item._id, { state: a.outcome === "applied" ? "applied" : "acked" });
  const feedback =
    a.outcome === "applied" ? "confirmed" : a.outcome === "rejected" ? "false_positive" : undefined;
  if (feedback) await ctx.db.patch(item.classificationId, { feedback });
  return { status: 200, text: `${a.outcome} ${a.itemId}` };
}

async function run(ctx: MutationCtx, member: Doc<"members">, agent: Doc<"agents">, tool: Tool, raw: unknown) {
  switch (tool) {
    case "status":
      return status(ctx, agent);
    case "inbox":
      return inbox(ctx, agent);
    case "ack":
      return ack(ctx, member, raw);
    case "post_knowledge":
      return postKnowledge(ctx, agent, McpArgs.post_knowledge.parse(raw));
    case "post_decision":
      return postDecision(ctx, agent, McpArgs.post_decision.parse(raw));
    case "report_failure":
      return reportFailure(ctx, agent, McpArgs.report_failure.parse(raw));
    case "ask":
      return ask(ctx, agent, McpArgs.ask.parse(raw));
    case "answer":
      return answer(ctx, agent, McpArgs.answer.parse(raw));
  }
}

/**
 * Not an MCP tool: the Stop hook's background merge check asks which teammates' branches to merge-tree against.
 * Answered before the agent is touched so a detached job never marks the session active.
 */
async function branches(ctx: MutationCtx, agent: Doc<"agents">): Promise<McpResult> {
  const out: { handle: string; branch: string }[] = [];
  const mates = agent.sessionId ? await sessionAgents(ctx, agent.sessionId) : [];
  for (const a of mates) {
    if (a.status !== "active" || a._id === agent._id || a.repo !== agent.repo) continue;
    if (!a.branch || a.branch === agent.branch) continue;
    const member = await ctx.db.get(a.memberId);
    if (member && !out.some((o) => o.branch === a.branch))
      out.push({ handle: member.handle, branch: a.branch });
  }
  return { status: 200, text: JSON.stringify(out) };
}

export const call = internalMutation({
  args: { tokenHash: v.string(), tool: v.string(), claudeSessionId: v.string(), args: v.any() },
  handler: async (ctx, a): Promise<McpResult> => {
    const member = await memberByTokenHash(ctx, a.tokenHash);
    if (!member) return { status: 401, text: "unauthorized" };
    if (a.tool === "branches") {
      const agent = await resolveAgent(ctx, member._id, a.claudeSessionId);
      return agent ? branches(ctx, agent) : { status: 404, text: "no session yet" };
    }
    if (!isTool(a.tool)) return { status: 404, text: `unknown tool ${a.tool}` };
    const parsed = McpArgs[a.tool].safeParse(a.args ?? {});
    if (!parsed.success) return { status: 400, text: parsed.error.message };
    const agent = await resolveAgent(ctx, member._id, a.claudeSessionId);
    if (!agent) return { status: 404, text: "no session yet; start Claude Code with the plugin first" };

    const now = Date.now();
    await ctx.db.patch(agent._id, { lastSeenAt: now, status: "active" });
    const result = await run(ctx, member, agent, a.tool, parsed.data);
    const out: McpResult = "status" in result ? result : { status: 200, text: result.text };
    await ctx.db.insert("events", {
      agentId: agent._id,
      eventKey: `mcp:${agent._id}:${now}:${Math.random().toString(36).slice(2)}`,
      source: "mcp",
      hook: a.tool,
      files: [],
      summary: out.text.slice(0, 300),
      payload: { args: parsed.data },
      nodeId: "nodeId" in result ? result.nodeId : undefined,
      at: now,
    });
    return out;
  },
});
