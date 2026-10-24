import { TopicMap } from "@lb/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { Ctx, Klass } from "./shared";

// Every read the board makes, bounded. The page shows one run, so these caps are generous.
const LANE_LIMIT = 6;
const NODES_PER_AGENT = 150;
const TASKS_PER_AGENT = 60;
const EVENTS_PER_AGENT = 300;
const INBOX_PER_AGENT = 40;
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

export type Source = {
  agents: Doc<"agents">[];
  handles: Map<Id<"agents">, string>;
  colors: Map<Id<"agents">, number>;
  nodes: Doc<"nodes">[];
  nodeById: Map<Id<"nodes">, Doc<"nodes">>;
  tasks: Doc<"tasks">[];
  /** Oldest first, lane agents plus verify runs. */
  events: Doc<"events">[];
  inbox: Doc<"inbox">[];
  /** Non-normal verdicts inside the board's time window. */
  verdicts: Klass[];
  /** Every recent verdict, for the top-bar counts. */
  recentVerdicts: Klass[];
  /** Topic → owning handle, from the repo's topic map. */
  topicOwners: Map<string, string>;
};

async function ownersOf(ctx: Ctx, repo: string | undefined): Promise<Map<string, string>> {
  if (!repo) return new Map();
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", `topics:${repo}`))
    .first();
  const map = TopicMap.safeParse(row?.value);
  return new Map(map.success ? Object.entries(map.data.topics).map(([k, v]) => [k, v.owner]) : []);
}

async function perAgent<T>(agents: Doc<"agents">[], load: (a: Doc<"agents">) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (const a of agents) out.push(...(await load(a)));
  return out;
}

export async function loadSource(ctx: Ctx): Promise<Source> {
  const agents = (await laneAgents(ctx)).sort((a, b) => a._creationTime - b._creationTime);
  const members = await ctx.db.query("members").take(MEMBER_SCAN);
  // Color follows the member, not the session, so a person keeps one color across runs.
  const memberColor = new Map(members.map((m, i) => [m._id, (i % 6) + 1]));
  const memberHandle = new Map(members.map((m) => [m._id, m.handle]));
  const handles = new Map(agents.map((a) => [a._id, memberHandle.get(a.memberId) ?? "agent"]));
  const colors = new Map(agents.map((a) => [a._id, memberColor.get(a.memberId) ?? 1]));

  const nodes = await perAgent(agents, (a) =>
    ctx.db
      .query("nodes")
      .withIndex("by_agent", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(NODES_PER_AGENT),
  );
  const tasks = await perAgent(agents, (a) =>
    ctx.db
      .query("tasks")
      .withIndex("by_agent", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(TASKS_PER_AGENT),
  );
  const events = await perAgent(agents, (a) =>
    ctx.db
      .query("events")
      .withIndex("by_agent_time", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(EVENTS_PER_AGENT),
  );
  const inbox = await perAgent(agents, async (a) =>
    (
      await ctx.db
        .query("inbox")
        .withIndex("by_agent_state", (q) => q.eq("agentId", a._id))
        .take(INBOX_PER_AGENT * 4)
    )
      .filter((i) => i.state !== "queued")
      .slice(-INBOX_PER_AGENT),
  );
  const start = nodes.length > 0 ? Math.min(...nodes.map((n) => n.at)) - 1000 : 0;
  const recentVerdicts = await ctx.db.query("classifications").order("desc").take(VERDICT_SCAN);
  const verdicts = recentVerdicts.filter((c) => c.at >= start && c.type !== "normal");

  // A verdict can point at a lesson, decision or step from an agent outside the lanes; pull that node in.
  const nodeById = new Map(nodes.map((n) => [n._id, n]));
  for (const c of verdicts) {
    for (const id of [c.nodeId, c.againstNodeId]) {
      if (!id || nodeById.has(id)) continue;
      const n = await ctx.db.get(id);
      if (n?.kind === "knowledge") {
        nodes.push(n);
        nodeById.set(n._id, n);
      }
    }
  }
  const verify = (
    await ctx.db
      .query("events")
      .withIndex("by_time", (q) => q.gte("at", start))
      .order("desc")
      .take(200)
  ).filter((e) => e.source === "verify");
  nodes.sort((a, b) => a.at - b.at);
  tasks.sort((a, b) => a.startedAt - b.startedAt);
  const allEvents = [...events, ...verify].sort((a, b) => a.at - b.at);
  inbox.sort((a, b) => a.at - b.at);
  return {
    topicOwners: await ownersOf(ctx, agents[0]?.repo),
    agents,
    handles,
    colors,
    nodes,
    nodeById,
    tasks,
    events: allEvents,
    inbox,
    verdicts,
    recentVerdicts,
  };
}
