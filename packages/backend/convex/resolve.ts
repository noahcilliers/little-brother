import { primarySymbol } from "@lb/core";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation } from "./_generated/server";
import { assertAgentVisible, viewerMember } from "./access";
import { subjectThing } from "./dashboardQueries/labels";
import { insertNode, topicFor } from "./nodes";
import { refreshSavingsFor } from "./savings";
import { notify, settleCatch } from "./settle";
import { supersedeTaskOf } from "./tasks";

// Human decisions from the dashboard resolve panel: team members only, except in local open mode.

// Without a topic map, name the topic after the contested file: src/auth/session.ts → auth.session.
function topicFromPath(path: string | undefined): string {
  if (!path) return "topic";
  return path
    .replace(/^(src|app|lib|packages)\//, "")
    .replace(/\.[a-z]+$/i, "")
    .replace(/\//g, ".");
}

function winnerLabel(n: Doc<"nodes">): string {
  const words = n.text.split(/\s+/).filter((w) => w !== n.verb && w !== n.topic);
  const label = words
    .join(" ")
    .replace(/\s*→.*$/, "")
    .trim();
  return (label || n.files[0] || n.text).slice(0, 80);
}

/** The value a decision records: what the winning side built (its symbol or label), not what it set out to do. */
function winnerValue(n: Doc<"nodes">): string {
  return (primarySymbol(n.touches) ?? n.label ?? winnerLabel(n)).slice(0, 80);
}

/** A decision reads as what the winning side set out to build: its task subject, e.g. "JWT tokens". */
async function decisionValue(ctx: MutationCtx, keep: Doc<"nodes">): Promise<string> {
  const task = keep.taskId ? await ctx.db.get(keep.taskId) : null;
  return task ? subjectThing(task.subject).slice(0, 80) : winnerValue(keep);
}

export async function supersede(ctx: MutationCtx, lose: Doc<"nodes">, note = "Superseded by a decision.") {
  if (lose.outcome !== "superseded") await ctx.db.patch(lose._id, { outcome: "superseded" });
  await supersedeTaskOf(ctx, lose, note);
  const later = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", lose.agentId).gte("at", lose.at))
    .take(200);
  for (const n of later) {
    if (n.parentId === lose._id && n.outcome === "open") await ctx.db.patch(n._id, { outcome: "superseded" });
  }
}

/** The open catch a dashboard viewer may settle, and how the board names them. */
async function openForViewer(ctx: MutationCtx, classificationId: Id<"classifications">) {
  const c = await ctx.db.get(classificationId);
  if (!c) throw new ConvexError("classification not found");
  await assertAgentVisible(ctx, c.agentIds[0]);
  if (c.status !== "open")
    throw new ConvexError(`already ${c.status}${c.resolvedBy ? ` by ${c.resolvedBy}` : ""}`);
  const handle = (await viewerMember(ctx))?.handle;
  return { c, by: handle ? `${handle} on the dashboard` : "the dashboard" };
}

async function topicOf(ctx: MutationCtx, c: Doc<"classifications">): Promise<string> {
  const [a, b] = await Promise.all([
    ctx.db.get(c.nodeId),
    c.againstNodeId ? ctx.db.get(c.againstNodeId) : null,
  ]);
  return a?.topic ?? b?.topic ?? topicFromPath(a?.files[0] ?? b?.files[0]);
}

export const approve = mutation({
  args: { classificationId: v.id("classifications"), keepNodeId: v.id("nodes") },
  handler: async (ctx, { classificationId, keepNodeId }) => {
    const { c, by } = await openForViewer(ctx, classificationId);
    const loseId =
      keepNodeId === c.nodeId ? c.againstNodeId : keepNodeId === c.againstNodeId ? c.nodeId : undefined;
    if (!loseId) throw new ConvexError("keepNodeId is not a side of this classification");
    const [keep, lose] = await Promise.all([ctx.db.get(keepNodeId), ctx.db.get(loseId)]);
    if (!keep || !lose) throw new ConvexError("node missing");

    const now = Date.now();
    const agent = await ctx.db.get(keep.agentId);
    const topic =
      keep.topic ??
      lose.topic ??
      (agent && (await topicFor(ctx, agent.repo, keep.files))) ??
      topicFromPath(keep.files[0]);
    const winner = await decisionValue(ctx, keep);
    const decisionText = `DECIDE ${topic} = ${winner}`;

    const decisionId = await insertNode(ctx, {
      agentId: keep.agentId,
      kind: "knowledge",
      verb: "DECIDE",
      text: decisionText,
      label: `${topic} = ${winner}`,
      topic,
      files: keep.files,
      parentId: keep._id,
      outcome: "succeeded",
      at: now,
    });
    await settleCatch(ctx, c, {
      status: "resolved",
      resolution: `kept ${winner}`,
      by,
      outcome: "human_override",
      feedback: "confirmed",
      agentId: keep.agentId,
      summary: decisionText,
      files: keep.files,
      nodeId: decisionId,
    });

    // Settled first: the savings estimate counts only catches that are closed.
    await supersede(ctx, lose, `Superseded: ${by} chose ${topic} = ${winner}.`);
    await refreshSavingsFor(ctx, [lose._id]);

    const affected = new Set([...c.agentIds, keep.agentId, lose.agentId]);
    for (const agentId of affected) {
      const losing = agentId === lose.agentId;
      const text = losing
        ? `decided · ${by} kept ${winner} for ${topic}. Your steps on "${lose.text}" are superseded; rebuild on ${winner} before continuing.`
        : `decided · ${by} kept your ${winner} for ${topic}. Carry on; the other side is switching to it.`;
      await notify(ctx, agentId, c._id, text, losing ? "block" : "warn");
    }
    return { decisionNodeId: decisionId };
  },
});

/** Not a real clash: both sides carry on, and the catch counts as a false positive. */
export const dismiss = mutation({
  args: { classificationId: v.id("classifications") },
  handler: async (ctx, { classificationId }) => {
    const { c, by } = await openForViewer(ctx, classificationId);
    const topic = await topicOf(ctx, c);
    await settleCatch(ctx, c, {
      status: "dismissed",
      resolution: "dismissed as compatible",
      by,
      feedback: "false_positive",
      agentId: c.agentIds[0] ?? (await requireNodeAgent(ctx, c)),
      summary: `dismissed ${c.type} on ${topic}`,
    });
    for (const agentId of c.agentIds)
      await notify(
        ctx,
        agentId,
        c._id,
        `cleared · ${by} marked the ${c.type} on ${topic} as compatible. Go ahead with your step; you won't be stopped for it again.`,
      );
  },
});

/** A real clash, but a person lets it go ahead: an ordering wait lifted, or both versions kept on purpose. */
export const release = mutation({
  args: { classificationId: v.id("classifications") },
  handler: async (ctx, { classificationId }) => {
    const { c, by } = await openForViewer(ctx, classificationId);
    const topic = await topicOf(ctx, c);
    await settleCatch(ctx, c, {
      status: "resolved",
      resolution: "let both continue",
      by,
      outcome: "human_release",
      feedback: "confirmed",
      agentId: c.agentIds[0] ?? (await requireNodeAgent(ctx, c)),
      summary: `released ${c.type} on ${topic}`,
    });
    for (const agentId of c.agentIds)
      await notify(
        ctx,
        agentId,
        c._id,
        `released · ${by} let both sides continue on ${topic}. Retry your step; you won't be stopped for it again.`,
      );
  },
});

async function requireNodeAgent(ctx: MutationCtx, c: Doc<"classifications">): Promise<Id<"agents">> {
  const n = await ctx.db.get(c.nodeId);
  if (!n) throw new ConvexError("node missing");
  return n.agentId;
}
