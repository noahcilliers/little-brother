import { type HookInput, TASK_TOOLS, type TaskRef, type TaskStatus, type TodoItem } from "@lb/core";

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
};
const firstOf = (o: Record<string, unknown>, keys: string[], max: number): string | undefined => {
  for (const k of keys) {
    const s = text(o[k], max);
    if (s) return s;
  }
  return undefined;
};

/** The task tools' status words are unconfirmed; map the plausible spellings, drop the rest. */
export function taskStatus(v: unknown): TaskStatus | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.toLowerCase().replace(/[\s-]+/g, "_");
  if (["in_progress", "inprogress", "active", "started", "doing"].includes(s)) return "in_progress";
  if (["completed", "complete", "done", "finished"].includes(s)) return "completed";
  if (["pending", "todo", "open", "not_started"].includes(s)) return "pending";
  return undefined;
}

const ID_KEYS = ["taskId", "task_id", "id"];
const SUBJECT_KEYS = ["subject", "title", "content", "task_subject"];

/**
 * A TaskCreate/TaskUpdate call as a task reference. Input shapes are unconfirmed, so this reads any of
 * {subject|title|content, description, status, taskId|task_id|id}; the id may only be in the tool response
 * (TaskCreate), possibly nested under `task`.
 */
function taskFromCall(input: Record<string, unknown>, response: unknown): TaskRef | undefined {
  const resp = rec(response);
  const key =
    firstOf(input, ID_KEYS, 200) ?? firstOf(rec(resp.task), ID_KEYS, 200) ?? firstOf(resp, ID_KEYS, 200);
  const subject = firstOf(input, SUBJECT_KEYS, 300) ?? firstOf(rec(resp.task), SUBJECT_KEYS, 300);
  const resolvedKey = key ?? (subject ? `subject:${subject.slice(0, 190)}` : undefined);
  if (!resolvedKey) return undefined;
  const ref: TaskRef = { key: resolvedKey };
  if (subject) ref.subject = subject;
  const description = text(input.description, 1000) ?? text(input.activeForm, 1000);
  if (description) ref.description = description;
  const status = taskStatus(input.status);
  if (status) ref.status = status;
  return ref;
}

function todosOf(input: Record<string, unknown>): TodoItem[] | undefined {
  if (!Array.isArray(input.todos)) return undefined;
  const out: TodoItem[] = [];
  for (const raw of input.todos.slice(0, 100)) {
    const t = rec(raw);
    const content = text(t.content, 300) ?? text(t.subject, 300) ?? text(t.title, 300);
    if (!content) continue;
    const item: TodoItem = { content, status: taskStatus(t.status) ?? "pending" };
    const activeForm = text(t.activeForm, 300);
    if (activeForm) item.activeForm = activeForm;
    out.push(item);
  }
  return out;
}

export type TaskFields = { task?: TaskRef; todos?: TodoItem[] };

/** Envelope task fields for task hooks and task-tool calls. Never throws: unknown shapes yield nothing. */
export function taskFields(input: HookInput): TaskFields {
  try {
    const n = input.hook_event_name;
    if (n === "TaskCreated" || n === "TaskCompleted") {
      const subject = text(input.task_subject, 300);
      const key = text(input.task_id, 200) ?? (subject ? `subject:${subject.slice(0, 190)}` : undefined);
      if (!key) return {};
      const task: TaskRef = { key };
      if (subject) task.subject = subject;
      const description = text(input.task_description, 1000);
      if (description) task.description = description;
      if (n === "TaskCompleted") task.status = "completed";
      return { task };
    }
    if (n !== "PreToolUse" && n !== "PostToolUse") return {};
    if (!TASK_TOOLS.has(input.tool_name)) return {};
    if (input.tool_name === "TodoWrite") {
      const todos = todosOf(input.tool_input);
      return todos ? { todos } : {};
    }
    if (input.tool_name !== "TaskCreate" && input.tool_name !== "TaskUpdate") return {};
    const response = "tool_response" in input ? input.tool_response : undefined;
    const task = taskFromCall(input.tool_input, response);
    return task ? { task } : {};
  } catch {
    return {};
  }
}
