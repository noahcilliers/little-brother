import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation } from "./_generated/server";
import { insertNode, topicFor } from "./nodes";

// Human decisions from the dashboard resolve panel. Unauthenticated for the hackathon.

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

export async function supersede(ctx: MutationCtx, lose: Doc<"nodes">) {
  if (lose.outcome !== "superseded") await ctx.db.patch(lose._id, { outcome: "superseded" });
  const later = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", lose.agentId).gte("at", lose.at))
    .take(200);
  for (const n of later) {
    if (n.parentId === lose._id && n.outcome === "open") await ctx.db.patch(n._id, { outcome: "superseded" });
  }
}

export const approve = mutation({
  args: { classificationId: v.id("classifications"), keepNodeId: v.id("nodes") },
  handler: async (ctx, { classificationId, keepNodeId }) => {
    const c = await ctx.db.get(classificationId);
    if (!c) throw new ConvexError("classification not found");
    if (c.status !== "open") throw new ConvexError(`classification already ${c.status}`);
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
    // An action's intent says what was chosen better than its file path does.
    const intent = keep.kind === "action" && keep.parentId ? await ctx.db.get(keep.parentId) : null;
    const winner = winnerLabel(intent ?? keep);
    const decisionText = `DECIDE ${topic} = ${winner}`;

    await ctx.db.patch(c._id, {
      status: "resolved",
      feedback: "confirmed",
      resolution: `approved ${keep._id}`,
      outcome: "human_override",
    });
    await supersede(ctx, lose);
    const decisionId = await insertNode(ctx, {
      agentId: keep.agentId,
      kind: "knowledge",
      verb: "DECIDE",
      text: decisionText,
      topic,
      files: keep.files,
      parentId: keep._id,
      outcome: "succeeded",
      at: now,
    });
    await ctx.db.insert("events", {
      agentId: keep.agentId,
      eventKey: `resolve:${c._id}`,
      source: "human",
      hook: "Resolve",
      files: keep.files,
      summary: decisionText,
      payload: { classificationId: c._id, keepNodeId: keep._id, loseNodeId: lose._id },
      nodeId: decisionId,
      at: now,
    });

    const affected = new Set([...c.agentIds, keep.agentId, lose.agentId]);
    for (const agentId of affected) {
      const losing = agentId === lose.agentId;
      const text = losing
        ? `Owner resolved ${topic}: ${decisionText}. Your steps on "${lose.text}" are superseded; rebuild on ${winner} before continuing.`
        : `Owner resolved ${topic}: ${decisionText}. Your approach stands; the other side is switching to it.`;
      await ctx.db.insert("inbox", {
        agentId,
        classificationId: c._id,
        text,
        action: losing ? "block" : "warn",
        state: "queued",
        attempts: 0,
        at: now,
      });
    }
    return { decisionNodeId: decisionId };
  },
});

export const dismiss = mutation({
  args: { classificationId: v.id("classifications") },
  handler: async (ctx, { classificationId }) => {
    const c = await ctx.db.get(classificationId);
    if (!c) throw new ConvexError("classification not found");
    await ctx.db.patch(c._id, { status: "dismissed", feedback: "false_positive", resolution: "dismissed" });
  },
});
