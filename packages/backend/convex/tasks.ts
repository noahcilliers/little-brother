import { failureReason, firstSentence, type TaskRef, type TaskStatus } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Task = Doc<"tasks">;

export const isLive = (t: Task): boolean => t.status === "pending" || t.status === "in_progress";
// Set from evidence (a denial, a failed run, a decision); the agent's own "completed" doesn't overwrite them.
const EVIDENCED = new Set<Task["status"]>(["stopped", "abandoned", "superseded"]);
const RUN_VERBS = new Set(["TEST", "RUN"]);

/** The agent's tasks, latest start first. */
export function recentTasks(ctx: QueryCtx, agentId: Id<"agents">, limit = 50): Promise<Task[]> {
  return ctx.db
    .query("tasks")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(limit);
}

/** The agent's current task: the in-progress one started last. */
export async function currentTask(ctx: QueryCtx, agentId: Id<"agents">): Promise<Task | undefined> {
  return (await recentTasks(ctx, agentId)).find((t) => t.status === "in_progress");
}

/** Action nodes attributed to a task, newest first. */
export async function taskActions(ctx: QueryCtx, task: Task, limit = 100): Promise<Doc<"nodes">[]> {
  const recent = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", task.agentId))
    .order("desc")
    .take(limit);
  return recent.filter((n) => n.taskId === task._id);
}

/** The task's last finished test or command, when it failed: the task never got back to green. */
async function failedLastRun(ctx: QueryCtx, task: Task): Promise<Doc<"nodes"> | undefined> {
  const actions = await taskActions(ctx, task);
  const last = actions.find((n) => RUN_VERBS.has(n.verb) && n.outcome !== "open");
  return last?.outcome === "failed" ? last : undefined;
}

async function failureNote(ctx: QueryCtx, failed: Doc<"nodes">): Promise<string> {
  const events = await ctx.db
    .query("events")
    .withIndex("by_agent_time", (q) => q.eq("agentId", failed.agentId).gte("at", failed.at))
    .take(30);
  const tail = events
    .filter((e) => e.nodeId === failed._id)
    .map((e) => (e.payload as { envelope?: { outputTail?: unknown } } | undefined)?.envelope?.outputTail)
    .find((t): t is string => typeof t === "string");
  const why = failureReason(tail)?.replace(/^\w*Error:\s*/, "");
  const what = failed.label ?? "last run";
  return why ? `${what} failed: ${why}` : `${what} failed`;
}

async function abandon(ctx: MutationCtx, task: Task, failed: Doc<"nodes">, now: number): Promise<void> {
  await ctx.db.patch(task._id, { status: "abandoned", endedAt: now, note: await failureNote(ctx, failed) });
}

/** Ends a task the agent finished: completed, or abandoned when its last run failed and nothing fixed it. */
export async function finishTask(ctx: MutationCtx, task: Task, now: number): Promise<void> {
  if (EVIDENCED.has(task.status)) {
    if (!task.endedAt) await ctx.db.patch(task._id, { endedAt: now });
    return;
  }
  const failed = await failedLastRun(ctx, task);
  if (failed) await abandon(ctx, task, failed, now);
  else await ctx.db.patch(task._id, { status: "completed", endedAt: now });
}

/** Moving on from a task whose last run failed means that path was given up. */
async function abandonFailedSiblings(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  keep: Id<"tasks">,
  now: number,
) {
  for (const t of await recentTasks(ctx, agentId)) {
    if (t._id === keep || t.status !== "in_progress") continue;
    const failed = await failedLastRun(ctx, t);
    if (failed) await abandon(ctx, t, failed, now);
  }
}

export async function setStatus(
  ctx: MutationCtx,
  task: Task,
  status: TaskStatus,
  now: number,
): Promise<void> {
  if (task.status === status) return;
  if (status === "completed") return finishTask(ctx, task, now);
  if (status === "pending") {
    await ctx.db.patch(task._id, { status });
    return;
  }
  // in_progress: the bar starts when work starts; reopening a finished task clears its end.
  await ctx.db.patch(task._id, {
    status,
    startedAt: task.status === "pending" ? now : task.startedAt,
    endedAt: undefined,
  });
  await abandonFailedSiblings(ctx, task.agentId, task._id, now);
}

async function findTask(ctx: MutationCtx, agentId: Id<"agents">, ref: TaskRef): Promise<Task | undefined> {
  const byKey = await ctx.db
    .query("tasks")
    .withIndex("by_key", (q) => q.eq("agentId", agentId).eq("taskKey", ref.key))
    .first();
  if (byKey) return byKey;
  if (!ref.subject) return undefined;
  // TaskCreated and the TaskCreate call both report one creation, possibly with different keys.
  const twin = (await recentTasks(ctx, agentId)).find(
    (t) => t.source === "task_tool" && isLive(t) && t.subject === ref.subject,
  );
  if (twin?.taskKey.startsWith("subject:") && !ref.key.startsWith("subject:"))
    await ctx.db.patch(twin._id, { taskKey: ref.key });
  return twin;
}

/** TaskCreated / TaskCompleted / TaskCreate / TaskUpdate / TodoWrite entry → the task row, created on first sight. */
export async function upsertTask(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  ref: TaskRef,
  now: number,
): Promise<Task> {
  const existing = await findTask(ctx, agent._id, ref);
  if (existing) {
    const patch: Partial<Task> = {};
    if (ref.subject && ref.subject !== existing.subject) patch.subject = ref.subject;
    if (ref.description && ref.description !== existing.description) patch.description = ref.description;
    if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
    if (ref.status) await setStatus(ctx, existing, ref.status, now);
    return (await ctx.db.get(existing._id)) ?? existing;
  }
  // A new task with no stated status starts right away only when nothing else is in progress.
  const status = ref.status ?? ((await currentTask(ctx, agent._id)) ? "pending" : "in_progress");
  const id = await ctx.db.insert("tasks", {
    agentId: agent._id,
    taskKey: ref.key,
    subject: ref.subject ?? `Task ${ref.key}`,
    description: ref.description,
    status,
    goalId: agent.intentId,
    source: "task_tool",
    startedAt: now,
    endedAt: status === "completed" ? now : undefined,
  });
  if (status === "in_progress") await abandonFailedSiblings(ctx, agent._id, id, now);
  const row = await ctx.db.get(id);
  if (!row) throw new Error("task insert lost");
  return row;
}

/** A denied action stops its task when the task has no successful work yet: it was cut short at the start. */
export async function stopOnDeny(ctx: MutationCtx, taskId: Id<"tasks">, reason: string, now: number) {
  const task = await ctx.db.get(taskId);
  if (!task || !isLive(task)) return;
  const actions = await taskActions(ctx, task);
  if (actions.some((n) => n.outcome === "succeeded" && n.verb !== "EXPLORE")) return;
  await ctx.db.patch(task._id, { status: "stopped", endedAt: now, note: firstSentence(reason) });
}

/** A decision overruled this node's work: its task is superseded, unless it already ended on evidence. */
export async function supersedeTaskOf(ctx: MutationCtx, node: Doc<"nodes">, note: string): Promise<void> {
  const task = node.taskId ? await ctx.db.get(node.taskId) : null;
  if (!task || task.status === "superseded" || task.status === "stopped" || task.status === "abandoned")
    return;
  await ctx.db.patch(task._id, { status: "superseded", endedAt: task.endedAt ?? Date.now(), note });
}

/**
 * Stop / SessionEnd: in-progress tasks end. Completed when the agent's last test passed and the task's own last
 * run didn't fail; otherwise the status stays and only the end time is set. The closing message becomes the
 * current task's note.
 */
export async function closeOpenTasks(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  passed: boolean,
  now: number,
  message?: string,
): Promise<number> {
  const open = (await recentTasks(ctx, agentId)).filter((t) => t.status === "in_progress");
  for (const [i, t] of open.entries()) {
    const note = i === 0 && message && !t.note ? firstSentence(message) : t.note;
    const ok = passed && !(await failedLastRun(ctx, t));
    await ctx.db.patch(t._id, { status: ok ? "completed" : t.status, endedAt: now, note });
  }
  return open.length;
}
