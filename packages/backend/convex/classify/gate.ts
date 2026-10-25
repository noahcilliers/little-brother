import {
  type ClassifiedNode,
  isActive,
  isMutation,
  isShared,
  type Judgment,
  type OpenConflict,
  RELATIONS,
  TopicMap,
  toClassifiedNode,
  topicGate,
} from "@lb/core";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { stored } from "./load";

const OPEN_SCAN = 100;
const RELATION_SET = new Set<string>(RELATIONS);

async function handleOf(ctx: QueryCtx, agentId: Doc<"agents">["_id"]): Promise<string | undefined> {
  const agent = await ctx.db.get(agentId);
  const member = agent ? await ctx.db.get(agent.memberId) : null;
  return member?.handle;
}

/** Open rows in the node's room; a gate only acts on rows involving this agent, which share its room. */
function openRows(ctx: QueryCtx, next: Doc<"nodes">): Promise<Doc<"classifications">[]> {
  return ctx.db
    .query("classifications")
    .withIndex("by_team_status", (q) => q.eq("teamId", next.teamId).eq("status", "open"))
    .order("desc")
    .take(OPEN_SCAN);
}

function mutatedPaths(n: ClassifiedNode): Set<string> {
  return new Set(n.touches.filter((t) => isMutation(t) && !t.generated).map((t) => t.path));
}

const PROGRESS_CLAIM = "claim: is further along";
type Lines = [number, number] | undefined;
const overlaps = (a: Lines, b: Lines): boolean => !a || !b || (a[0] <= b[1] && b[0] <= a[1]);

/** The first path where my mutation meets the claimed one's lines (unknown lines count as the whole file). */
function claimedHit(mine: ClassifiedNode, held: ClassifiedNode): string | undefined {
  const theirs = held.touches.filter((t) => isMutation(t) && !t.generated && !t.symbol);
  for (const t of mine.touches) {
    if (!isMutation(t) || t.generated || t.symbol) continue;
    if (theirs.some((h) => h.path === t.path && overlaps(t.lines, h.lines))) return t.path;
  }
  return undefined;
}

/**
 * Collisions settled by claim strength stay settled: while the winner's work is live and not yet shared,
 * the losing agent may not edit the files it claimed, even where no pairwise rule would fire again.
 */
export async function claimGate(
  ctx: QueryCtx,
  next: Doc<"nodes">,
  view: ClassifiedNode,
  now: number,
): Promise<Judgment[]> {
  if (next.kind !== "action") return [];
  const mine = mutatedPaths(view);
  if (mine.size === 0) return [];
  const rows = (await openRows(ctx, next)).filter(
    (c) =>
      c.winnerAgentId &&
      c.winnerAgentId !== next.agentId &&
      c.agentIds.includes(next.agentId) &&
      c.nodeId !== next._id &&
      c.againstNodeId !== next._id,
  );
  const out: Judgment[] = [];
  for (const c of rows) {
    const sides = [await ctx.db.get(c.nodeId), c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null];
    const held = sides.find((n) => n?.agentId === c.winnerAgentId);
    if (!held || !RELATION_SET.has(c.relation)) continue;
    if (held.outcome === "superseded" || isShared(held) || !isActive(held, now)) continue;
    // An owner, an approved decision or an assigned scope holds the whole file. A claim won only by being
    // further along holds its lines: the denial tells the other agent to keep out of them and retry, so an edit
    // elsewhere in the file must go through (CooperBench agents were denied on every retry and gave up).
    const byProgress = c.evidence.some((e) => e.startsWith(PROGRESS_CLAIM));
    const claimedNode = toClassifiedNode(stored(held));
    const hit = byProgress
      ? claimedHit(view, claimedNode)
      : [...mine].find((p) => mutatedPaths(claimedNode).has(p));
    if (!hit) continue;
    out.push({
      otherNodeId: held._id,
      relation: c.relation as Judgment["relation"],
      direction: "new_needs_other",
      confidence: c.confidence,
      evidence: [`${hit} is claimed by another agent`, c.reason.replace(/^\[little-brother\] \w+ · /, "")],
      action: "serialize",
      source: "rule",
      retrievalScore: 1,
      latencyMs: 0,
      type: c.type,
      winner: "other",
    });
  }
  return out;
}

/** Open blocking conflicts involving this agent, checked on every mutating edit until a human resolves them. */
export async function openConflictGate(
  ctx: QueryCtx,
  next: Doc<"nodes">,
  view: ClassifiedNode,
): Promise<Judgment[]> {
  if (next.kind !== "action") return [];
  const rows = await openRows(ctx, next);
  const mine = rows.filter(
    (c) => c.action === "block" && c.type === "conflict" && c.agentIds.includes(next.agentId),
  );
  if (mine.length === 0) return [];
  const agent = await ctx.db.get(next.agentId);
  const mapRow = agent
    ? await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", `topics:${agent.repo}`))
        .first()
    : null;
  const map = TopicMap.safeParse(mapRow?.value);
  if (!map.success) return [];
  const conflicts: OpenConflict[] = [];
  const handles = new Map<string, string | undefined>();
  for (const c of mine) {
    const a = await ctx.db.get(c.nodeId);
    const b = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
    if (!a || !b || !RELATION_SET.has(c.relation)) continue;
    // Work already pushed or merged is shared history; the other side rebases instead of waiting.
    if (isShared(a) || isShared(b)) continue;
    const topics = [a.topic, b.topic].filter((t): t is string => t !== undefined);
    for (const id of c.agentIds) if (!handles.has(id)) handles.set(id, await handleOf(ctx, id));
    conflicts.push({
      classificationId: c._id,
      relation: c.relation as OpenConflict["relation"],
      confidence: c.confidence,
      topics: [...new Set(topics)],
      agentIds: c.agentIds,
      otherNodeFor: { [a.agentId]: b._id, [b.agentId]: a._id },
      reason: c.reason,
    });
  }
  if (!handles.has(next.agentId)) handles.set(next.agentId, await handleOf(ctx, next.agentId));
  return topicGate(view, conflicts, map.data, (id) => handles.get(id));
}
