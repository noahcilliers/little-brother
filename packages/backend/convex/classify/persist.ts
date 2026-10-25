import {
  ACTION_RANK,
  type Action,
  catchKey,
  dedupe,
  interventionAction,
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
import { settledCatch } from "../settle";
import { stored } from "./load";
import { avoidedTokens, counterpartOf, openCatch, sharperType } from "./persistParts";

type Notified = "warn" | "serialize" | "block";

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
 * Step 7 + fan-out: store each judgment worth keeping (non-ignore, or any LLM verdict as a training label) and
 * queue inbox items. Alerts are kept once per catch (pair of goals): a later step of the same work re-uses the
 * open row and notifies nobody unless the severity rises. Returns the row each alerting judgment maps to.
 */
export async function persistJudgments(
  ctx: MutationCtx,
  next: Doc<"nodes">,
  judgments: Judgment[],
  opts: PersistOptions,
): Promise<Map<string, Id<"classifications">>> {
  const rows = new Map<string, Id<"classifications">>();
  // A takeover passes for the new node (action ignore) but is still news: the other side must stop.
  const keep = judgments.filter((j) => j.action !== "ignore" || j.source === "llm" || j.winner === "next");
  if (keep.length === 0) return rows;
  const eventId = await eventFor(ctx, next);
  const self = await counterpartOf(ctx, next);
  for (const raw of keep) {
    const otherId = ctx.db.normalizeId("nodes", raw.otherNodeId);
    const other = otherId ? await ctx.db.get(otherId) : null;
    if (!other) continue;
    const them0 = await counterpartOf(ctx, other);
    const j: Judgment = {
      ...raw,
      action: interventionAction({
        ...raw,
        avoidedTokens: await avoidedTokens(ctx, other),
      }),
    };
    const key = catchKey(next, other);
    const existing = j.action === "ignore" ? undefined : await openCatch(ctx, key);
    const settled = j.action === "ignore" || existing ? undefined : await settledCatch(ctx, key);
    if (settled) {
      rows.set(j.otherNodeId, settled._id);
      continue;
    }
    if (existing) {
      rows.set(j.otherNodeId, existing._id);
      // Same catch, no more severe: the agents already know. Only a rise in severity is news. A clash first
      // seen as an order or a file collision can turn out to be duplicated work or a repeated failure; then the
      // row takes the more specific reading, quietly, so the board and the stats say what it was.
      if (ACTION_RANK[j.action] <= ACTION_RANK[existing.action]) {
        const type = j.type ?? TYPE_OF[j.relation];
        if (sharperType(existing, type))
          await ctx.db.patch(existing._id, {
            type,
            relation: j.relation,
            reason: renderEvidence([j], () => them0),
            evidence: j.evidence,
          });
        continue;
      }
    }
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
    const decision = existing
      ? { kind: "raise" as const, id: existing._id }
      : dedupe(
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
      catchKey: key,
      at: Date.now(),
    };
    let classificationId: Id<"classifications">;
    if (decision.kind === "raise") {
      classificationId = decision.id as Id<"classifications">;
      // The raised row now describes this step: the hook enforces it as this step's own verdict, not as a
      // repeat of the milder notice the two goals had before (which made deny-once let the first real clash by).
      await ctx.db.patch(classificationId, { ...row, nodeId: next._id, againstNodeId: other._id });
    } else {
      classificationId = await ctx.db.insert("classifications", {
        ...row,
        ...(eventId ? { eventId } : {}),
        nodeId: next._id,
        againstNodeId: other._id,
        agentIds: next.agentId === other.agentId ? [next.agentId] : [next.agentId, other.agentId],
        ...(next.teamId ? { teamId: next.teamId } : {}),
        status: "open",
      });
    }
    rows.set(j.otherNodeId, classificationId);
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
  return rows;
}

export const SYNC_SELF: ReadonlySet<Action> = new Set<Action>(["warn"]);
export const ASYNC_SELF: ReadonlySet<Action> = new Set<Action>(["warn", "serialize", "block"]);
