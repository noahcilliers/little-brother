import {
  type Candidate,
  type ClassifiedNode,
  isActive,
  isFailureMemory,
  type StoredNode,
  type Thresholds,
  toClassifiedNode,
} from "@lb/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { type PriorityLoader, priorityLoader } from "./priority";
import { roomFailures, sessionWork } from "./scope";

const MEMORY_CAP = 50;

export function stored(n: Doc<"nodes">): StoredNode {
  return {
    _id: n._id,
    agentId: n.agentId,
    kind: n.kind,
    verb: n.verb,
    text: n.text,
    topic: n.topic,
    files: n.files,
    touches: n.touches,
    references: n.references,
    outcome: n.outcome,
    signature: n.signature,
    baseRev: n.baseRev,
    landed: n.landed,
    preview: n.preview,
    consumes: n.consumes,
    importers: n.importers,
    at: n.at,
  };
}

/** A node as the classifier sees it, with its author's claim strength for collision tie-breaks. */
export async function classifiedView(n: Doc<"nodes">, priority: PriorityLoader): Promise<ClassifiedNode> {
  return { ...toClassifiedNode(stored(n)), priority: await priority.of(n) };
}

export async function agentStatus(
  ctx: QueryCtx,
  ids: Iterable<Id<"agents">>,
): Promise<Map<string, Doc<"agents">>> {
  const out = new Map<string, Doc<"agents">>();
  for (const id of new Set(ids)) {
    const a = await ctx.db.get(id);
    if (a) out.set(id, a);
  }
  return out;
}

/**
 * Turn loaded nodes into candidates: failure memory from anyone in the same room, active work only from other
 * live agents in the same session. Vector and lexical retrieval read across rooms, so the scope is enforced here.
 */
export async function toCandidates(
  ctx: QueryCtx,
  next: Doc<"nodes">,
  nodes: Doc<"nodes">[],
  now: number,
  similarity: Map<string, number> = new Map(),
  priority: PriorityLoader = priorityLoader(ctx),
): Promise<Candidate[]> {
  const agents = await agentStatus(ctx, [next.agentId, ...nodes.map((n) => n.agentId)]);
  const mine = agents.get(next.agentId);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    // A revert restores the committed version: it is nobody's work, so it can't duplicate or conflict with any.
    if (n._id === next._id || seen.has(n._id) || n.outcome === "superseded" || n.verb === "REVERT") continue;
    seen.add(n._id);
    const sim = similarity.get(n._id);
    const base = { node: toClassifiedNode(stored(n)), ...(sim !== undefined ? { similarity: sim } : {}) };
    const agent = agents.get(n.agentId);
    if (!agent || agent.teamId !== mine?.teamId) continue;
    if (isFailureMemory(n)) {
      out.push({ ...base, failedMemory: true });
      continue;
    }
    // A finished agent's work still counts: its branch hasn't landed, and the active window (done + 30 min)
    // already ages it out. Skipping offline agents hid every clash with a teammate who finished first.
    if (n.agentId === next.agentId || agent.sessionId !== mine?.sessionId) continue;
    if (n.kind === "knowledge" || !isActive(n, now)) continue;
    out.push({ ...base, node: { ...base.node, priority: await priority.of(n) }, failedMemory: false });
  }
  return out;
}

/**
 * Structural candidate set (no embeddings): peers' active work in this session, plus the room's failure
 * memory by path, signature and topic.
 */
export async function loadStructural(
  ctx: QueryCtx,
  next: Doc<"nodes">,
  now: number,
): Promise<Doc<"nodes">[]> {
  const me = await ctx.db.get(next.agentId);
  if (!me) return [];
  const bySignature = next.signature
    ? await ctx.db
        .query("nodes")
        .withIndex("by_signature", (q) => q.eq("signature", next.signature))
        .take(MEMORY_CAP)
    : [];
  const byTopic = next.topic
    ? await ctx.db
        .query("nodes")
        .withIndex("by_topic", (q) => q.eq("topic", next.topic))
        .order("desc")
        .take(MEMORY_CAP)
    : [];
  return [
    ...(await sessionWork(ctx, me, now)),
    ...(await roomFailures(ctx, next, next.teamId ?? me.teamId, now)),
    ...bySignature.filter(isFailureMemory),
    ...byTopic.filter(isFailureMemory),
  ];
}

const THRESHOLDS_KEY = "classifier:thresholds";

export async function loadThresholds(ctx: QueryCtx): Promise<Thresholds> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", THRESHOLDS_KEY))
    .first();
  const value: unknown = row?.value;
  if (!value || typeof value !== "object") return {};
  const out: Thresholds = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === "number") out[k as keyof Thresholds] = v;
  return out;
}

export { THRESHOLDS_KEY };
