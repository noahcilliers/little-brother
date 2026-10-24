import {
  type Action,
  type Counterpart,
  dedupe,
  isFailureMemory,
  type Judgment,
  otherSideAction,
  renderEvidence,
  TYPE_OF,
  takeoverNotice,
  toClassifiedNode,
} from "@lb/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { stored } from "./load";

type Notified = "warn" | "serialize" | "block";

async function counterpartOf(ctx: QueryCtx, node: Doc<"nodes">): Promise<Counterpart> {
  const agent = await ctx.db.get(node.agentId);
  const member = agent ? await ctx.db.get(agent.memberId) : null;
  return { name: member?.handle ?? "another agent", active: agent?.status === "active", text: node.text };
}

/** The hook links the event to its node right before classifying, so it is among the agent's latest. */
async function eventFor(ctx: QueryCtx, node: Doc<"nodes">): Promise<Id<"events"> | undefined> {
  const recent = await ctx.db
    .query("events")
    .withIndex("by_agent_time", (q) => q.eq("agentId", node.agentId))
    .order("desc")
    .take(10);
  return recent.find((e) => e.nodeId === node._id)?._id;
}

function swapDirection(d: Judgment["direction"]): Judgment["direction"] {
  if (d === "new_needs_other") return "other_needs_new";
  if (d === "other_needs_new") return "new_needs_other";
  return "none";
}

async function enqueue(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  classificationId: Id<"classifications">,
  action: Action,
  text: string,
): Promise<void> {
  if (action === "ignore" || !text) return;
  await ctx.db.insert("inbox", {
    agentId,
    classificationId,
    text,
    action: action as Notified,
    state: "queued",
    attempts: 0,
    at: Date.now(),
  });
}

export type PersistOptions = {
  /** Which of the new node's own actions to also queue for its agent (the hook already answers the rest). */
  selfActions: ReadonlySet<Action>;
};

/**
 * Step 7 + fan-out: store each judgment worth keeping (non-ignore, or any LLM verdict as a training label),
 * de-duplicated per pair and relation, and queue inbox items for affected agents.
 */
export async function persistJudgments(
  ctx: MutationCtx,
  next: Doc<"nodes">,
  judgments: Judgment[],
  opts: PersistOptions,
): Promise<void> {
  // A takeover passes for the new node (action ignore) but is still news: the other side must stop.
  const keep = judgments.filter((j) => j.action !== "ignore" || j.source === "llm" || j.winner === "next");
  if (keep.length === 0) return;
  const eventId = await eventFor(ctx, next);
  const self = await counterpartOf(ctx, next);
  for (const j of keep) {
    const otherId = ctx.db.normalizeId("nodes", j.otherNodeId);
    const other = otherId ? await ctx.db.get(otherId) : null;
    if (!other) continue;
    // Both sides of a pair get classified (often concurrently, in separate actions), so look both ways:
    // A-vs-B and B-vs-A are one collision and must not alert twice.
    const forward = await ctx.db
      .query("classifications")
      .withIndex("by_pair", (q) => q.eq("nodeId", next._id).eq("againstNodeId", other._id))
      .take(20);
    const reverse = await ctx.db
      .query("classifications")
      .withIndex("by_pair", (q) => q.eq("nodeId", other._id).eq("againstNodeId", next._id))
      .take(20);
    const prior = [...forward, ...reverse];
    // Once a collision's claim is settled, re-classifying either side must not flip or re-announce it.
    if (prior.some((p) => p.status === "open" && p.relation === j.relation && p.winnerAgentId)) continue;
    const takeover = j.winner === "next";
    // Stored as warn so the hook (which denies on serialize rows for its node) lets the winner through.
    const rowAction: Action = takeover ? "warn" : j.action;
    const decision = dedupe(
      prior.map((p) => ({ id: p._id, relation: p.relation, action: p.action, status: p.status })),
      { relation: j.relation, action: rowAction },
    );
    if (decision.kind === "skip") continue;
    const them = await counterpartOf(ctx, other);
    const notice = takeover
      ? takeoverNotice(j, toClassifiedNode(stored(next)), toClassifiedNode(stored(other)), self.name)
      : "";
    const reason = takeover ? notice : renderEvidence([j], () => them);
    const winnerAgentId = takeover ? next.agentId : j.winner === "other" ? other.agentId : undefined;
    const row = {
      type: j.type ?? TYPE_OF[j.relation],
      relation: j.relation,
      direction: j.direction,
      action: rowAction,
      ...(winnerAgentId ? { winnerAgentId } : {}),
      reason: reason || `${j.relation} (${j.source}, ${j.confidence.toFixed(2)})`,
      evidence: j.evidence,
      confidence: j.confidence,
      retrievalScore: j.retrievalScore,
      source: j.source,
      latencyMs: j.latencyMs,
      at: Date.now(),
    };
    let classificationId: Id<"classifications">;
    if (decision.kind === "raise") {
      classificationId = decision.id as Id<"classifications">;
      await ctx.db.patch(classificationId, row);
    } else {
      classificationId = await ctx.db.insert("classifications", {
        ...row,
        ...(eventId ? { eventId } : {}),
        nodeId: next._id,
        againstNodeId: other._id,
        agentIds: next.agentId === other.agentId ? [next.agentId] : [next.agentId, other.agentId],
        status: "open",
      });
    }
    if (takeover) {
      await enqueue(ctx, other.agentId, classificationId, "serialize", notice);
      continue;
    }
    if (opts.selfActions.has(j.action)) await enqueue(ctx, next.agentId, classificationId, j.action, reason);
    if (other.agentId !== next.agentId) {
      const theirAction = otherSideAction(j, { kind: other.kind, failedMemory: isFailureMemory(other) });
      const flipped: Judgment = { ...j, action: theirAction, direction: swapDirection(j.direction) };
      await enqueue(
        ctx,
        other.agentId,
        classificationId,
        theirAction,
        renderEvidence([flipped], () => self),
      );
    }
  }
}

export const SYNC_SELF: ReadonlySet<Action> = new Set<Action>(["warn"]);
export const ASYNC_SELF: ReadonlySet<Action> = new Set<Action>(["warn", "serialize", "block"]);
