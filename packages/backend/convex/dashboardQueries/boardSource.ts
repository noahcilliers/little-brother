import type { Doc, Id } from "../_generated/dataModel";
import type { Ctx, Klass } from "./shared";

// Every read the board makes, bounded. The page shows one session run, so these caps are generous.
const LANE_LIMIT = 6;
const NODES_PER_AGENT = 80;
const EVENT_SCAN = 600;
const VERDICT_SCAN = 1000;
const MEMBER_SCAN = 100;
// Agents seen within this long of the most recent one belong to the same run.
const RUN_WINDOW_MS = 15 * 60 * 1000;

async function laneAgents(ctx: Ctx): Promise<Doc<"agents">[]> {
  const live = [
    ...(await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(LANE_LIMIT)),
    ...(await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "idle"))
      .take(LANE_LIMIT)),
  ].filter((a) => a.machine !== "verify");
  if (live.length > 0) return live.slice(0, LANE_LIMIT);
  const recent = (await ctx.db.query("agents").order("desc").take(30)).filter((a) => a.machine !== "verify");
  const latest = Math.max(0, ...recent.map((a) => a.lastSeenAt));
  return recent.filter((a) => latest - a.lastSeenAt < RUN_WINDOW_MS).slice(0, LANE_LIMIT);
}

export type BoardSource = {
  agents: Doc<"agents">[];
  handles: Map<Id<"agents">, string>;
  colors: Map<Id<"agents">, number>;
  nodes: Doc<"nodes">[];
  events: Doc<"events">[];
  /** Non-normal verdicts inside the board's time window. */
  verdicts: Klass[];
  /** Every recent verdict, for the top-bar counts. */
  recentVerdicts: Klass[];
};

export async function loadBoard(ctx: Ctx): Promise<BoardSource> {
  const agents = (await laneAgents(ctx)).sort((a, b) => a._creationTime - b._creationTime);
  const members = await ctx.db.query("members").take(MEMBER_SCAN);
  // Color follows the member, not the session, so a person keeps one color across runs.
  const memberColor = new Map(members.map((m, i) => [m._id, (i % 6) + 1]));
  const memberHandle = new Map(members.map((m) => [m._id, m.handle]));
  const handles = new Map(agents.map((a) => [a._id, memberHandle.get(a.memberId) ?? "unknown"]));
  const colors = new Map(agents.map((a) => [a._id, memberColor.get(a.memberId) ?? 1]));

  const nodes: Doc<"nodes">[] = [];
  for (const a of agents) {
    const rows = await ctx.db
      .query("nodes")
      .withIndex("by_agent", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(NODES_PER_AGENT);
    nodes.push(...rows);
  }
  const start = nodes.length > 0 ? Math.min(...nodes.map((n) => n.at)) - 1000 : 0;
  const events = await ctx.db
    .query("events")
    .withIndex("by_time", (q) => q.gte("at", start))
    .order("desc")
    .take(EVENT_SCAN);
  const recentVerdicts = await ctx.db.query("classifications").order("desc").take(VERDICT_SCAN);
  const verdicts = recentVerdicts.filter((c) => c.at >= start && c.type !== "normal");

  // A verdict can point at a lesson or decision from an agent outside the lanes; pull that node in.
  const have = new Set(nodes.map((n) => n._id));
  for (const c of verdicts) {
    if (!c.againstNodeId || have.has(c.againstNodeId)) continue;
    const n = await ctx.db.get(c.againstNodeId);
    if (n && n.kind === "knowledge") {
      nodes.push(n);
      have.add(n._id);
    }
  }
  nodes.sort((a, b) => a.at - b.at);
  return { agents, handles, colors, nodes, events, verdicts, recentVerdicts };
}
