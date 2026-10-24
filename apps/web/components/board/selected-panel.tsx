import type { Board, BoardTask } from "@/lib/api";
import { isOpen, stateAt, stateLabel, stopColor } from "@/lib/board-time";
import { CATCH_STYLE, chipText } from "@/lib/catch-style";
import { elapsed, kTokens } from "@/lib/format";
import { CATCH_ICON, InlineIcon } from "./icons";
import { StoryList } from "./story-list";

type Props = {
  board: Board;
  selected: string | null;
  t: number;
  start: number;
  colorOf: (agentId: string) => string;
  onOpenDecision: (id: string) => void;
};

function TaskDetail({
  board,
  k,
  t,
  start,
  colorOf,
  onOpenDecision,
}: Omit<Props, "selected"> & { k: BoardTask }) {
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
  const decision = board.decisions.find((d) => d.t <= t && d.sides.some((s) => s.taskId === k.id));
  const catches = board.catches.filter((c) => (c.from === k.id || c.to === k.id) && c.t <= t);
  return (
    <>
      <div className="title" title={k.subject}>
        {k.subject}
      </div>
      <div className="meta">
        {agent?.name ?? "agent"}
        {goal ? ` · goal: ${goal.label}` : k.inferred ? " · goal inferred from actions" : ""}
      </div>
      <div>
        <span className="state" style={{ color }}>
          {stateLabel(k, state)}
        </span>
      </div>
      {k.tokens !== undefined ? (
        <div className="meta">
          spent {kTokens(k.tokens)} tokens{state === "abandoned" || state === "superseded" ? " · wasted" : ""}
        </div>
      ) : null}
      {k.note && state !== "running" && !pendingSupersede ? <p className="empty">{k.note}</p> : null}
      <StoryList lines={lines} start={start} />
      {catches.length > 0 ? (
        <ul className="catches">
          {catches.map((c) => {
            const color = isOpen(c, t) ? CATCH_STYLE[c.kind].color : "var(--faint)";
            return (
              <li key={c.id}>
                <InlineIcon name={CATCH_ICON[c.kind]} color={color} size={13} />
                <span>
                  <b className="chip" style={{ color }}>
                    {chipText(c)}
                  </b>
                  <small className="why">{c.text}</small>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {decision ? (
        <button type="button" className="open-decision" onClick={() => onOpenDecision(decision.id)}>
          <InlineIcon name="bolt" color="var(--hot)" size={13} />
          Open decision on {decision.topic}
        </button>
      ) : null}
    </>
  );
}

/** What the selected task did, step by step, its catches, and a way into the decision when one is waiting. */
export function SelectedPanel({ board, selected, t, start, colorOf, onOpenDecision }: Props) {
  const task = board.tasks.find((k) => k.id === selected);
  const shared = board.shared.find((s) => s.id === selected);
  let body: React.ReactNode = (
    <p className="empty">Click a task to see what the agent did and which files it touched.</p>
  );
  if (task && task.t0 <= t) {
    body = (
      <TaskDetail
        board={board}
        k={task}
        t={t}
        start={start}
        colorOf={colorOf}
        onOpenDecision={onOpenDecision}
      />
    );
  } else if (shared && shared.t <= t) {
    body = (
      <>
        <div className="title" title={shared.label}>
          {shared.label}
        </div>
        <div className="meta">
          {shared.kind} · {elapsed(shared.t, start)}
        </div>
        <p className="empty">{shared.note}</p>
      </>
    );
  }
  return (
    <div className="card selected">
      <div className="h">Selected task</div>
      <div className="detail">{body}</div>
    </div>
  );
}
