import type { Doc } from "../_generated/dataModel";
import { actionLabel, capitalize, clip, lbSentence } from "./labels";
import { attachRoutine } from "./routine";
import { payloadString } from "./shared";
import type { Source } from "./source";

export type BoardAction = {
  id: string;
  t: number;
  label: string;
  file?: string;
  outcome: Doc<"nodes">["outcome"];
  /** Reads and plan bookkeeping: drawn as small grey ticks. */
  routine: boolean;
  tokens?: number;
};
export type StopKind = "duplicate" | "stale" | "conflict";
export type TaskState = "running" | "done" | "abandoned" | "stopped" | "superseded";
export type BoardTask = {
  id: string;
  agentId: string;
  goalId?: string;
  subject: string;
  state: TaskState;
  t0: number;
  /** null while running: the client draws it up to now. */
  t1: number | null;
  note?: string;
  /** For a stopped task: which kind of catch stopped it. */
  stopKind?: StopKind;
  supersededAt?: number;
  /** Tokens the agent spent on this step. */
  tokens?: number;
  inferred: boolean;
  actions: BoardAction[];
};

type N = Doc<"nodes">;
// An inferred task's bar extends this far past its last action so a one-action step is still visible.
const TAIL_MS = 1500;

export const isRoutine = (n: N) => n.verb === "EXPLORE";
const isWork = (n: N) => n.kind === "action" && !isRoutine(n);

export function toAction(n: N): BoardAction {
  return {
    id: n._id,
    t: n.at,
    label: actionLabel(n),
    file: n.files[0],
    outcome: n.outcome,
    routine: isRoutine(n),
  };
}

/** Denials and failures by node, read from the hook log: the pre-hook logs a denial as "denied …". */
export function hookFacts(events: Doc<"events">[]) {
  const denied = new Map<string, string>();
  const deniedKind = new Map<string, StopKind>();
  const failed = new Map<string, string>();
  for (const e of events) {
    if (!e.nodeId) continue;
    const reason = payloadString(e, "output", "hookSpecificOutput", "permissionDecisionReason");
    if (e.summary.startsWith("denied "))
      denied.set(e.nodeId, reason ? lbSentence(reason) : "Stopped by a hook.");
    const kind = reason?.match(/\b(duplicate|stale|conflict)\s*·/)?.[1];
    if (kind === "duplicate" || kind === "stale" || kind === "conflict") deniedKind.set(e.nodeId, kind);
    const tail = payloadString(e, "envelope", "outputTail");
    if (tail && e.summary.endsWith("FAIL"))
      failed.set(e.nodeId, clip(tail.trim().split("\n").pop() ?? "", 140));
  }
  return { denied, deniedKind, failed };
}

const STATE: Record<Doc<"tasks">["status"], TaskState> = {
  pending: "running",
  in_progress: "running",
  completed: "done",
  stopped: "stopped",
  abandoned: "abandoned",
  superseded: "superseded",
};

function realTask(t: Doc<"tasks">, actions: N[], live: boolean): BoardTask {
  let state = STATE[t.status];
  const last = actions[actions.length - 1]?.at ?? t.startedAt;
  // An open task of a session that is gone did not keep running; draw it up to its last action.
  if (state === "running" && t.endedAt === undefined && !live) state = "done";
  const t1 = t.endedAt ?? (state === "running" ? null : last);
  return {
    id: t._id,
    agentId: t.agentId,
    goalId: t.goalId,
    subject: t.subject,
    state,
    t0: t.startedAt,
    t1,
    note: t.note,
    inferred: false,
    actions: actions.map(toAction),
  };
}

function inferredSubject(first: N): string {
  if (first.topic) return capitalize(first.topic.replace(/[._/-]+/g, " "));
  return capitalize(actionLabel(first));
}

/** Older data has no task list: consecutive actions under one goal on one topic read as one task. */
function inferredTasks(src: Source, facts: ReturnType<typeof hookFacts>): BoardTask[] {
  const out: BoardTask[] = [];
  for (const a of src.agents) {
    const loose = src.nodes.filter((n) => n.agentId === a._id && isWork(n) && !n.taskId);
    const runs: N[][] = [];
    for (const n of loose) {
      const run = runs[runs.length - 1];
      const head = run?.[0];
      const closed = run?.[run.length - 1]?.outcome === "failed";
      // Commands carry no topic: a test run belongs to the step it checks. A failure closes the step.
      const joins =
        head &&
        head.parentId === n.parentId &&
        ((!n.topic && n.files.length === 0) || head.topic === n.topic);
      if (run && joins && !closed) run.push(n);
      else runs.push([n]);
    }
    runs.forEach((run, i) => {
      const first = run[0];
      const last = run[run.length - 1];
      if (!first || !last) return;
      const open = last.outcome === "open" && a.status === "active" && i === runs.length - 1;
      const deny = facts.denied.get(last._id);
      let state: TaskState = "done";
      if (open) state = "running";
      else if (last.outcome === "failed") state = "abandoned";
      else if (deny) state = "stopped";
      else if (last.outcome === "superseded") state = "superseded";
      out.push({
        id: `inferred:${first._id}`,
        agentId: a._id,
        goalId: first.parentId,
        subject: inferredSubject(first),
        state,
        t0: first.at,
        t1: open ? null : last.at + TAIL_MS,
        note: deny ?? (state === "abandoned" ? facts.failed.get(last._id) : undefined),
        inferred: true,
        actions: run.map(toAction),
      });
    });
  }
  return out;
}

/** Bars: the agents' own tasks, plus inferred ones for actions recorded without a task. */
export function buildTasks(src: Source) {
  const facts = hookFacts(src.events);
  const live = new Set(src.agents.filter((a) => a.status === "active").map((a) => a._id as string));
  const byTask = new Map<string, N[]>();
  for (const n of src.nodes) {
    if (n.kind !== "action" || !n.taskId) continue;
    byTask.set(n.taskId, [...(byTask.get(n.taskId) ?? []), n]);
  }
  const tasks = [
    ...src.tasks.map((t) => realTask(t, byTask.get(t._id) ?? [], live.has(t.agentId))),
    ...inferredTasks(src, facts),
  ].sort((a, b) => a.t0 - b.t0);
  for (const t of tasks) {
    if (t.state !== "stopped") continue;
    t.stopKind = [...t.actions]
      .reverse()
      .map((x) => facts.deniedKind.get(x.id))
      .find((k) => k !== undefined);
  }
  const loose = attachRoutine(src, tasks);
  // Every action node maps to the bar it is drawn on, for catches and session lines.
  const taskOfNode = new Map<string, string>();
  for (const t of tasks) for (const x of t.actions) taskOfNode.set(x.id, t.id);
  return { tasks, taskOfNode, facts, loose };
}
