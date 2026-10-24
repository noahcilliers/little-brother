import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Projections shared by the dashboard read models. Every read here is bounded.

export type Ctx = Pick<QueryCtx, "db">;
export type Klass = Doc<"classifications">;

const LANDED_SCAN = 100;

export function slimNode(n: Doc<"nodes">) {
  return {
    _id: n._id,
    agentId: n.agentId,
    kind: n.kind,
    verb: n.verb,
    text: n.text,
    topic: n.topic,
    files: n.files,
    outcome: n.outcome,
    parentId: n.parentId,
    signature: n.signature,
    baseRev: n.baseRev,
    landed: n.landed,
    at: n.at,
  };
}
export type SlimNode = ReturnType<typeof slimNode>;

async function landedCounts(ctx: Ctx, agentId: Id<"agents">) {
  const rows = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(LANDED_SCAN);
  const counts = { committed: 0, pushed: 0, merged: 0 };
  for (const n of rows) if (n.landed) counts[n.landed] += 1;
  return counts;
}

export async function agentLabel(ctx: Ctx, agent: Doc<"agents">) {
  const member = await ctx.db.get(agent.memberId);
  return {
    _id: agent._id,
    handle: member?.handle ?? "unknown",
    branch: agent.branch,
    repo: agent.repo,
    machine: agent.machine,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt,
    intentId: agent.intentId,
    baseRev: agent.baseRev,
    git: agent.git,
  };
}

/** agentLabel plus how many of its recent nodes have reached git; for lane headers and the agents table. */
export async function agentWithBranch(ctx: Ctx, agent: Doc<"agents">) {
  return { ...(await agentLabel(ctx, agent)), landed: await landedCounts(ctx, agent._id) };
}

export function handleCache(ctx: Ctx) {
  const cache = new Map<Id<"agents">, Promise<string>>();
  return (id: Id<"agents">) => {
    let hit = cache.get(id);
    if (!hit) {
      hit = ctx.db.get(id).then(async (a) => (a ? (await agentLabel(ctx, a)).handle : "unknown"));
      cache.set(id, hit);
    }
    return hit;
  };
}
export type HandleOf = ReturnType<typeof handleCache>;

export function worstVerdict(list: Klass[]) {
  const rank = { conflict: 3, duplicate: 2, stale: 1, normal: 0 } as const;
  const live = list.filter((c) => c.status !== "dismissed" && c.type !== "normal");
  live.sort((a, b) => rank[b.type] - rank[a.type]);
  return live[0];
}

export function verdictsForNode(ctx: Ctx, nodeId: Id<"nodes">, limit = 10) {
  return ctx.db
    .query("classifications")
    .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
    .take(limit);
}

/**
 * Under the priority policy the newer action can win a collision; when the winner is the agent behind
 * nodeId (the newer side) the classification is a takeover of the older side's claim.
 */
export async function takeoverOf(ctx: Ctx, c: Klass, handle: HandleOf) {
  if (!c.winnerAgentId || !c.againstNodeId) return undefined;
  const [node, against] = await Promise.all([ctx.db.get(c.nodeId), ctx.db.get(c.againstNodeId)]);
  if (!node || !against || node.agentId !== c.winnerAgentId) return undefined;
  const shared = node.files.find((f) => against.files.includes(f));
  return {
    winner: await handle(node.agentId),
    loser: await handle(against.agentId),
    file: shared ?? node.files[0] ?? node.topic ?? "the contested change",
  };
}
export type Takeover = NonNullable<Awaited<ReturnType<typeof takeoverOf>>>;

export function takeoverText(t: Takeover): string {
  return `${t.winner} took over ${t.file} from ${t.loser} (owner)`;
}
