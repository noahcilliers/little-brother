import type { Doc } from "../_generated/dataModel";
import { decisionLabel, goalLabel, knowledgeNote, lessonLabel } from "./labels";
import type { Source } from "./source";
import type { BoardTask } from "./tasks";

export type BoardGoal = {
  id: string;
  agentId: string;
  label: string;
  text: string;
  t0: number;
  t1: number | null;
};
export type SharedKind = "lesson" | "decision";
export type BoardShared = {
  id: string;
  kind: SharedKind;
  agentId: string;
  t: number;
  label: string;
  note: string;
  /** The task it came from: a lesson's failed attempt, a decision's winning side. */
  fromTask?: string;
};

// A goal with no work yet still gets a short bracket.
const MIN_GOAL_MS = 2000;

/** Goals are the prompts; each bracket spans the work done under it. */
export function buildGoals(src: Source, tasks: BoardTask[]): BoardGoal[] {
  const intents = src.nodes.filter((n) => n.kind === "intent");
  return intents.map((g) => {
    const agent = src.agents.find((a) => a._id === g.agentId);
    const mine = tasks.filter((t) => t.goalId === g._id);
    const loose = src.nodes.filter((n) => n.parentId === g._id && n.kind === "action").map((n) => n.at);
    const running = mine.some((t) => t.t1 === null);
    const current = agent?.status === "active" && agent.intentId === g._id && mine.length === 0;
    const end = Math.max(g.at + MIN_GOAL_MS, ...loose, ...mine.map((t) => t.t1 ?? t.t0));
    return {
      id: g._id,
      agentId: g.agentId,
      label: goalLabel(g),
      text: g.text,
      t0: g.at,
      t1: running || current ? null : end,
    };
  });
}

function sourceTask(n: Doc<"nodes">, src: Source, tasks: BoardTask[], taskOfNode: Map<string, string>) {
  const parent = n.parentId ? src.nodeById.get(n.parentId) : undefined;
  if (!parent) return undefined;
  if (parent.kind === "action") return taskOfNode.get(parent._id);
  const under = tasks.filter((t) => t.goalId === parent._id && t.t0 <= n.at);
  // A lesson comes from the attempt that failed; a decision from the latest step of its goal.
  const failed = under.filter((t) => t.state === "abandoned");
  return (n.verb === "DECIDE" ? under : failed.length ? failed : under).pop()?.id;
}

/** Lessons and decisions: shared knowledge that sits between the rows. */
export function buildShared(src: Source, tasks: BoardTask[], taskOfNode: Map<string, string>): BoardShared[] {
  return src.nodes
    .filter((n) => n.kind === "knowledge" || n.verb === "DECIDE")
    .map((n) => {
      const kind: SharedKind = n.verb === "DECIDE" ? "decision" : "lesson";
      return {
        id: n._id,
        kind,
        agentId: n.agentId,
        t: n.at,
        label: kind === "decision" ? decisionLabel(n) : lessonLabel(n),
        note: knowledgeNote(n),
        fromTask: sourceTask(n, src, tasks, taskOfNode),
      };
    });
}
