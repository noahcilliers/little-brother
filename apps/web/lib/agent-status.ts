import type { Board } from "./api";
import { isOpen, isRunning, stateAt } from "./board-time";

export type AgentStatus = "decision" | "working" | "blocked" | "idle";

/** One word for what an agent is doing at t: waiting on a person, working, held back, or idle. */
export function agentStatus(board: Board, agentId: string, t: number): AgentStatus {
  if (board.decisions.some((d) => d.t <= t && d.sides.some((s) => s.agentId === agentId))) return "decision";
  const mine = board.tasks.filter((k) => k.agentId === agentId && k.t0 <= t);
  const last = mine[mine.length - 1];
  const waiting = board.catches.some(
    (c) =>
      c.kind === "ordering" && isOpen(c, t) && board.tasks.find((k) => k.id === c.from)?.agentId === agentId,
  );
  if (waiting) return "blocked";
  if (mine.some((k) => isRunning(k, t))) return "working";
  if (last && stateAt(last, t) === "stopped") return "blocked";
  return "idle";
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  decision: "needs a decision",
  working: "working",
  blocked: "blocked or waiting",
  idle: "idle",
};
