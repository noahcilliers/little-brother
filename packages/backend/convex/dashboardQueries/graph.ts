import type { Doc, Id } from "../_generated/dataModel";
import {
  agentLabel,
  agentWithBranch,
  type Ctx,
  handleCache,
  type SlimNode,
  slimNode,
  takeoverOf,
} from "./shared";

const LANE_LIMIT = 8;
const NODES_PER_LANE = 40;
const EDGE_SCAN = 300;

async function laneAgents(ctx: Ctx) {
  const live = [
    ...(await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(LANE_LIMIT)),
    ...(await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "idle"))
      .take(LANE_LIMIT)),
  ];
  return live.length > 0
    ? live.slice(0, LANE_LIMIT)
    : await ctx.db.query("agents").order("desc").take(LANE_LIMIT);
}

export async function graph(ctx: Ctx) {
  const agents = await laneAgents(ctx);
  const nodes = new Map<Id<"nodes">, SlimNode>();
  for (const a of agents) {
    const rows = await ctx.db
      .query("nodes")
      .withIndex("by_agent", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(NODES_PER_LANE);
    for (const n of rows) nodes.set(n._id, slimNode(n));
  }
  const verdicts = (await ctx.db.query("classifications").order("desc").take(EDGE_SCAN)).filter(
    (c) => c.type !== "normal" && c.againstNodeId !== undefined,
  );
  // An edge may point at a node outside the visible lanes (e.g. an offline agent's failure); pull it in with its lane.
  const agentIds = new Set(agents.map((a) => a._id));
  const extraAgents: Doc<"agents">[] = [];
  for (const c of verdicts) {
    for (const id of [c.nodeId, c.againstNodeId]) {
      if (!id || nodes.has(id)) continue;
      const n = await ctx.db.get(id);
      if (!n) continue;
      nodes.set(n._id, slimNode(n));
      if (!agentIds.has(n.agentId)) {
        const a = await ctx.db.get(n.agentId);
        if (a) extraAgents.push(a);
        agentIds.add(n.agentId);
      }
    }
  }
  const edges = verdicts
    .filter((c) => c.againstNodeId && nodes.has(c.againstNodeId) && nodes.has(c.nodeId))
    .map((c) => {
      const target = nodes.get(c.nodeId);
      return {
        _id: c._id,
        source: c.againstNodeId as Id<"nodes">,
        target: c.nodeId,
        type: c.type,
        relation: c.relation,
        action: c.action,
        status: c.status,
        gitStatus: c.gitStatus,
        takeover: c.winnerAgentId !== undefined && target?.agentId === c.winnerAgentId,
      };
    });
  const lanes = await Promise.all([...agents, ...extraAgents].map((a) => agentWithBranch(ctx, a)));
  return { lanes, nodes: [...nodes.values()].sort((a, b) => a.at - b.at), edges };
}

export async function nodeDetail(ctx: Ctx, nodeId: Id<"nodes">) {
  const node = await ctx.db.get(nodeId);
  if (!node) return null;
  const agent = await ctx.db.get(node.agentId);
  const events = (
    await ctx.db
      .query("events")
      .withIndex("by_agent_time", (q) => q.eq("agentId", node.agentId).gte("at", node.at - 60 * 60 * 1000))
      .take(300)
  )
    .filter((e) => e.nodeId === nodeId)
    .map((e) => ({
      _id: e._id,
      hook: e.hook,
      tool: e.tool,
      summary: e.summary,
      files: e.files,
      tokens: e.tokens,
      at: e.at,
    }));
  const handle = handleCache(ctx);
  const related = [
    ...(await ctx.db
      .query("classifications")
      .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
      .take(20)),
    ...(await ctx.db
      .query("classifications")
      .withIndex("by_against", (q) => q.eq("againstNodeId", nodeId))
      .take(20)),
  ];
  const verdicts = await Promise.all(
    related.map(async (c) => {
      const otherId = c.nodeId === nodeId ? c.againstNodeId : c.nodeId;
      const other = otherId ? await ctx.db.get(otherId) : null;
      return {
        _id: c._id,
        type: c.type,
        relation: c.relation,
        action: c.action,
        status: c.status,
        reason: c.reason,
        evidence: c.evidence,
        confidence: c.confidence,
        source: c.source,
        gitStatus: c.gitStatus,
        takeover: await takeoverOf(ctx, c, handle),
        other: other ? { ...slimNode(other), handle: await handle(other.agentId) } : null,
      };
    }),
  );
  return {
    node: { ...slimNode(node), touches: node.touches, references: node.references },
    agent: agent ? await agentLabel(ctx, agent) : null,
    events,
    verdicts,
  };
}
