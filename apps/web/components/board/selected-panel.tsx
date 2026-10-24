import type { Board, BoardTask } from "@/lib/api";
import { isOpen, stateAt, stateLabel, stopColor } from "@/lib/board-time";
import { elapsed } from "@/lib/format";
import { ResolveActions } from "./resolve-actions";
import { StoryList } from "./story-list";

type Props = {
  board: Board;
  selected: string | null;
  t: number;
  start: number;
  colorOf: (agentId: string) => string;
};

function TaskDetail({ board, k, t, start, colorOf }: Omit<Props, "selected"> & { k: BoardTask }) {
  const state = stateAt(k, t);
  const agent = board.agents.find((a) => a.id === k.agentId);
  const goal = board.goals.find((g) => g.id === k.goalId);
  const lines = (board.sessions.find((s) => s.agentId === k.agentId)?.lines ?? []).filter(
    (l) => l.task === k.id && l.t <= t,
  );
  const color =
    state === "running" || state === "done"
      ? colorOf(k.agentId)
      : state === "stopped"
        ? stopColor(k)
        : state === "abandoned"
          ? "var(--hot)"
          : "var(--muted)";
  // A superseded task's note explains the supersession, so it waits for the decision.
  const pendingSupersede = k.supersededAt !== undefined && t < k.supersededAt;
  const conflict = board.catches.find(
    (c) =>
      c.kind === "conflict" && (c.from === k.id || c.to === k.id) && isOpen(c, t) && c.sides.length === 2,
  );
  return (
    <>
      <div className="title">{k.subject}</div>
      <div className="meta">
        {agent?.name ?? "agent"} · goal: {goal?.label ?? (k.inferred ? "inferred from actions" : "")}
      </div>
      <div>
        <span className="state" style={{ color }}>
          {stateLabel(k, state)}
        </span>
      </div>
      {k.note && state !== "running" && !pendingSupersede ? <p className="empty">{k.note}</p> : null}
      <StoryList lines={lines} start={start} />
      {conflict ? <ResolveActions conflict={conflict} /> : null}
    </>
  );
}

/** What the selected task did, step by step, with the decision buttons when it is in an open conflict. */
export function SelectedPanel({ board, selected, t, start, colorOf }: Props) {
  const task = board.tasks.find((k) => k.id === selected);
  const shared = board.shared.find((s) => s.id === selected);
  let body: React.ReactNode = (
    <p className="empty">Click a task to see what the agent did and which files it touched.</p>
  );
  if (task && task.t0 <= t) {
    body = <TaskDetail board={board} k={task} t={t} start={start} colorOf={colorOf} />;
  } else if (shared && shared.t <= t) {
    body = (
      <>
        <div className="title">{shared.label}</div>
        <div className="meta">
          {shared.kind} · {elapsed(shared.t, start)}
        </div>
        <p className="empty">{shared.note}</p>
      </>
    );
  }
  return (
    <div className="card">
      <div className="h">Selected task</div>
      <div className="detail">{body}</div>
    </div>
  );
}
