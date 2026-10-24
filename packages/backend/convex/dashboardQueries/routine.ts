import type { Source } from "./source";
import { type BoardAction, type BoardTask, isRoutine, toAction } from "./tasks";

export type LooseAction = BoardAction & { agentId: string };

// Plan bookkeeping is not work (no action node), but it is part of what the agent did.
const TASK_TOOLS = new Set(["TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "TodoWrite"]);

/**
 * Routine steps (reads, task-list updates) that no task claimed: inside a bar's span they join that bar as grey
 * ticks; outside every bar they stay on the row. Returns the ones left on the row.
 */
export function attachRoutine(src: Source, tasks: BoardTask[]): LooseAction[] {
  const steps: LooseAction[] = [];
  for (const n of src.nodes) {
    if (n.kind === "action" && isRoutine(n) && !n.taskId) steps.push({ ...toAction(n), agentId: n.agentId });
  }
  for (const e of src.events) {
    if (e.hook !== "PostToolUse" || !e.tool || !TASK_TOOLS.has(e.tool)) continue;
    const label = e.summary.startsWith(e.tool) ? e.summary : e.tool;
    steps.push({ id: e._id, t: e.at, label, outcome: "succeeded", routine: true, agentId: e.agentId });
  }
  const loose: LooseAction[] = [];
  for (const s of steps) {
    const home = tasks.find((k) => k.agentId === s.agentId && k.t0 <= s.t && (k.t1 === null || s.t <= k.t1));
    if (!home) {
      loose.push(s);
      continue;
    }
    const { agentId: _, ...action } = s;
    home.actions.push(action);
    home.actions.sort((a, b) => a.t - b.t);
  }
  return loose;
}
