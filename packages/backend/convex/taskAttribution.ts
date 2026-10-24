import { inferredSubject } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { latestActions } from "./nodes";
import { finishTask, recentTasks, setStatus, taskActions } from "./tasks";

export type ActionInfo = { verb: string; topic?: string; label: string; at: number };

const INFERRED_PREFIX = "inferred:";

async function nextInferredKey(ctx: MutationCtx, agentId: Id<"agents">): Promise<string> {
  // ";" sorts right after ":", so this range is exactly the "inferred:" keys.
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_key", (q) =>
      q.eq("agentId", agentId).gte("taskKey", INFERRED_PREFIX).lt("taskKey", "inferred;"),
    )
    .collect();
  return `${INFERRED_PREFIX}${rows.length + 1}`;
}

/**
 * Fallback for agents that keep no task list. Consecutive actions under one prompt form a task while their topic
 * stays the same: a new topic, or a new prompt, starts the next one. Reads and actions without a topic (commands)
 * join the open task. A task holding only reads so far is renamed by its first real change.
 */
async function inferredTask(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  recent: Doc<"tasks">[],
  a: ActionInfo,
): Promise<Id<"tasks">> {
  const openInferred = recent.filter((t) => t.source === "inferred" && t.status === "in_progress");
  const open = openInferred.find((t) => t.goalId === agent.intentId);
  if (open) {
    if (a.verb === "EXPLORE" || !a.topic) return open._id;
    const actions = await taskActions(ctx, open, 50);
    const topic = actions.find((n) => n.topic && n.verb !== "EXPLORE")?.topic;
    if (topic === a.topic) return open._id;
    if (!topic) {
      await ctx.db.patch(open._id, { subject: inferredSubject(a) });
      return open._id;
    }
  }
  for (const t of openInferred) await finishTask(ctx, t, a.at);
  return ctx.db.insert("tasks", {
    agentId: agent._id,
    taskKey: await nextInferredKey(ctx, agent._id),
    subject: inferredSubject(a),
    status: "in_progress",
    goalId: agent.intentId,
    source: "inferred",
    startedAt: a.at,
  });
}

/** A fix landing in a different task than the run that failed means the failed task's path was given up. */
async function abandonOnFixElsewhere(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  taskId: Id<"tasks">,
  a: ActionInfo,
) {
  if (a.verb !== "FIX" && a.verb !== "REVERT") return;
  const recent = await latestActions(ctx, agent._id, 20);
  const failed = recent.find((n) => n.parentId === agent.intentId && n.outcome !== "open");
  if (failed?.outcome !== "failed" || !failed.taskId || failed.taskId === taskId) return;
  const task = await ctx.db.get(failed.taskId);
  if (task?.status === "in_progress" || task?.status === "pending") await finishTask(ctx, task, a.at);
}

/**
 * The task an action belongs to: the agent's in-progress task-list task; else its next pending one, which this
 * action starts; else an inferred task.
 */
export async function taskForAction(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  a: ActionInfo,
): Promise<Id<"tasks">> {
  const recent = await recentTasks(ctx, agent._id);
  const own = recent.filter((t) => t.source === "task_tool");
  let taskId = own.find((t) => t.status === "in_progress")?._id;
  if (!taskId) {
    const next = own.filter((t) => t.status === "pending").pop();
    if (next) {
      await setStatus(ctx, next, "in_progress", a.at);
      taskId = next._id;
    }
  }
  taskId ??= await inferredTask(ctx, agent, recent, a);
  await abandonOnFixElsewhere(ctx, agent, taskId, a);
  return taskId;
}

/** A new prompt ends the inferred grouping of the previous one. */
export async function closeInferredTasks(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  now: number,
): Promise<void> {
  for (const t of await recentTasks(ctx, agentId)) {
    if (t.source === "inferred" && t.status === "in_progress") await finishTask(ctx, t, now);
  }
}
