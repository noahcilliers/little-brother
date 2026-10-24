import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { stored } from "./load";

function outputTail(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("envelope" in payload)) return undefined;
  const env: unknown = payload.envelope;
  if (!env || typeof env !== "object" || !("outputTail" in env)) return undefined;
  return typeof env.outputTail === "string" ? env.outputTail : undefined;
}

/** The intent and its actions, oldest first, with the output of failed commands for the "why". */
export const trajectory = internalQuery({
  args: { intentId: v.id("nodes") },
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.db.get(intentId);
    if (!intent) return null;
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_agent", (q) => q.eq("agentId", intent.agentId).gte("at", intent.at))
      .take(500);
    const actions = nodes.filter(
      (n) => n.parentId === intentId && n.kind === "action" && n.outcome !== "superseded",
    );
    const failed = new Set<string>(actions.filter((n) => n.outcome === "failed").map((n) => n._id));
    const outputs = new Map<string, string>();
    if (failed.size > 0) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_agent_time", (q) => q.eq("agentId", intent.agentId).gte("at", intent.at - 60_000))
        .take(1000);
      for (const e of events) {
        const tail = e.nodeId && failed.has(e.nodeId) ? outputTail(e.payload) : undefined;
        if (e.nodeId && tail) outputs.set(e.nodeId, tail);
      }
    }
    const step = (n: Doc<"nodes">) => ({ ...stored(n), output: outputs.get(n._id) });
    return { intent: stored(intent), actions: actions.map(step) };
  },
});

export const insertLesson = internalMutation({
  args: {
    intentId: v.id("nodes"),
    text: v.string(),
    topic: v.optional(v.string()),
    files: v.array(v.string()),
    outcome: v.union(v.literal("failed"), v.literal("succeeded")),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const intent = await ctx.db.get(a.intentId);
    if (!intent) return null;
    const existing = (
      await ctx.db
        .query("nodes")
        .withIndex("by_agent", (q) => q.eq("agentId", intent.agentId).gte("at", intent.at))
        .take(500)
    ).find((n) => n.kind === "knowledge" && n.parentId === a.intentId);
    if (existing) return null;
    return ctx.db.insert("nodes", {
      agentId: intent.agentId,
      kind: "knowledge",
      verb: "LEARN",
      text: a.text,
      ...(a.topic ? { topic: a.topic } : {}),
      files: a.files,
      touches: [],
      references: [],
      parentId: a.intentId,
      outcome: a.outcome,
      ...(a.signature ? { signature: a.signature } : {}),
      at: Date.now(),
    });
  },
});
