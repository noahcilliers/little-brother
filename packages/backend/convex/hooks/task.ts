import type { TaskRef, TodoItem } from "@lb/core";
import { upsertTask } from "../tasks";
import type { HookHandler } from "./types";

/** TaskCreated / TaskCompleted hooks: the agent's own plan steps. */
export const onTaskEvent: HookHandler = async ({ ctx, hook, agent, env }) => {
  if (!env.task) return { output: null, summary: `${hook} without a task id` };
  const task = await upsertTask(ctx, agent, env.task, Date.now());
  return { output: null, summary: `${hook} "${task.subject}" → ${task.status}` };
};

// Apply a TodoWrite snapshot finished-first, so the step that is in progress now is the last one started.
const TODO_ORDER: Record<TodoItem["status"], number> = { completed: 0, pending: 1, in_progress: 2 };

const todoRef = (t: TodoItem): TaskRef => ({
  key: `todo:${t.content.slice(0, 190)}`,
  subject: t.content,
  description: t.activeForm,
  status: t.status,
});

/**
 * TaskCreate / TaskUpdate / TodoWrite calls (and TaskGet / TaskList, which only read). They are plan bookkeeping,
 * not work, so they never become action nodes or get classified. Only PostToolUse applies them: by then the
 * call has happened.
 */
export const onTaskTool: HookHandler = async ({ ctx, hook, agent, env }) => {
  const tool = env.tool ?? "task tool";
  if (hook !== "PostToolUse") return { output: null, summary: `${tool} (recorded)` };
  const now = Date.now();
  const refs = [...(env.todos ?? [])]
    .sort((a, b) => TODO_ORDER[a.status] - TODO_ORDER[b.status])
    .map(todoRef);
  if (env.task) refs.push(env.task);
  const subjects: string[] = [];
  for (const ref of refs) {
    const task = await upsertTask(ctx, agent, ref, now);
    subjects.push(`"${task.subject}" ${task.status}`);
  }
  return { output: null, summary: subjects.length ? `${tool} ${subjects.join(", ")}` : `${tool} (recorded)` };
};
