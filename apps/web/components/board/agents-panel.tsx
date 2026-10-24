import { agentStatus, STATUS_LABEL } from "@/lib/agent-status";
import type { Board } from "@/lib/api";
import { isRunning, lastBefore } from "@/lib/board-time";
import { kTokens } from "@/lib/format";
import { InlineIcon } from "./icons";

const STATUS_ICON = { decision: "bolt", working: "pulse", blocked: "wall", idle: "idle" } as const;

type Props = {
  board: Board;
  t: number;
  focus: string | null;
  onFocus: (id: string | null) => void;
  colorOf: (agentId: string) => string;
};

/** Each agent with what it is doing at t: its running task, or its goal and idle. Clicking one dims the rest. */
export function AgentsPanel({ board, t, focus, onFocus, colorOf }: Props) {
  return (
    <div className="card">
      <div className="h">Agents</div>
      <div>
        {board.agents.map((a) => {
          const now = board.tasks.filter((k) => k.agentId === a.id && k.t0 <= t).pop();
          const goal = lastBefore(
            board.goals.filter((g) => g.agentId === a.id).map((g) => ({ ...g, t: g.t0 })),
            t,
          );
          const live = now !== undefined && isRunning(now, t);
          const color = colorOf(a.id);
          const status = agentStatus(board, a.id, t);
          return (
            <button
              key={a.id}
              type="button"
              className="agent"
              aria-pressed={focus === a.id}
              onClick={() => onFocus(focus === a.id ? null : a.id)}
            >
              <span className={live ? "dot live" : "dot"} style={{ background: color, color }} />
              <span>
                <b>{a.name}</b>
                <small>
                  {live ? now.subject : goal ? `${goal.label} · ${STATUS_LABEL[status]}` : "not started"}
                </small>
              </span>
              {a.tokens !== undefined ? <span className="tok">{kTokens(a.tokens)}</span> : null}
              <InlineIcon
                name={STATUS_ICON[status]}
                color={
                  status === "decision"
                    ? "var(--hot)"
                    : status === "blocked"
                      ? "var(--warn)"
                      : status === "working"
                        ? color
                        : "var(--faint)"
                }
                size={13}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
