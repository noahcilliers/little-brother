import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { refreshSavingsFor } from "./savings";

const ROLLUP_SCAN = 500;

async function agentNodes(ctx: MutationCtx, agentId: Id<"agents">, since = 0): Promise<Doc<"nodes">[]> {
  return ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId).gte("at", since))
    .order("desc")
    .take(ROLLUP_SCAN);
}

const sum = (nodes: Doc<"nodes">[]) => nodes.reduce((t, n) => t + (n.tokens ?? 0), 0);

/**
 * Stop / SessionEnd / PreCompact: the transcript's per-tool-call tokens land on the action nodes (matched by
 * tool_use id), then roll up to their tasks (`tasks.tokens`) and goals (the intent node's `tokens`). Savings
 * estimates that depend on those tasks are refreshed. Idempotent: every Stop resends the whole transcript.
 */
export async function applyToolTokens(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  toolTokens: Record<string, number> | undefined,
): Promise<number> {
  const tasks = new Set<Id<"tasks">>();
  const goals = new Set<Id<"nodes">>();
  let patched = 0;
  for (const [toolUseId, tokens] of Object.entries(toolTokens ?? {})) {
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_tool_use", (q) => q.eq("toolUseId", toolUseId))
      .first();
    if (!node || node.agentId !== agent._id) continue;
    if (node.tokens !== tokens) {
      await ctx.db.patch(node._id, { tokens });
      patched++;
    }
    if (node.taskId) tasks.add(node.taskId);
    if (node.parentId) goals.add(node.parentId);
  }
  if (tasks.size === 0 && goals.size === 0) return patched;

  const nodes = await agentNodes(ctx, agent._id);
  for (const taskId of tasks) {
    const total = sum(nodes.filter((n) => n.taskId === taskId));
    const task = await ctx.db.get(taskId);
    if (task && task.tokens !== total) await ctx.db.patch(taskId, { tokens: total });
  }
  for (const goalId of goals) {
    const goal = await ctx.db.get(goalId);
    if (goal?.kind !== "intent") continue;
    const total = sum(nodes.filter((n) => n.parentId === goalId && n.kind === "action"));
    if (goal.tokens !== total) await ctx.db.patch(goalId, { tokens: total });
  }
  // Catches against this agent's work (it was the owner or the failed path) and catches it received.
  await refreshSavingsFor(
    ctx,
    nodes.map((n) => n._id),
  );
  return patched;
}
