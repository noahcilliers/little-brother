import type { ReactNode } from "react";
import type { BoardGoal, BoardShared, LooseAction } from "@/lib/api";
import { stateAt, stateLabel } from "@/lib/board-time";
import { elapsed, kTokens } from "@/lib/format";
import { type DetailProps, TaskDetail } from "./task-detail";

type Props = DetailProps & { selected: string | null; onSelect: (id: string) => void };

function Who({ name, color, extra }: { name: string; color: string; extra?: string }) {
  return (
    <div className="meta">
      <i className="who" style={{ background: color }} />
      {name}
      {extra ? ` · ${extra}` : ""}
    </div>
  );
}

function GoalDetail({ board, g, t, start, colorOf, onSelect }: Props & { g: BoardGoal }) {
  const agent = board.agents.find((a) => a.id === g.agentId);
  const tasks = board.tasks.filter((k) => k.goalId === g.id && k.t0 <= t);
  const span = g.t1 !== null && g.t1 <= t ? `${elapsed(g.t0, start)}–${elapsed(g.t1, start)}` : "in progress";
  return (
    <>
      <div className="title">{g.label}</div>
      <Who name={agent?.name ?? "agent"} color={colorOf(g.agentId)} extra={span} />
      {g.text !== g.label ? <p className="empty">{g.text}</p> : null}
      {tasks.length > 0 ? (
        <ul className="goal-tasks">
          {tasks.map((k) => (
            <li key={k.id}>
              <button type="button" onClick={() => onSelect(k.id)}>
                <span className="clamp">{k.subject}</span>
                <small>{stateLabel(k, stateAt(k, t))}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function SharedDetail({ board, s, start, colorOf }: Props & { s: BoardShared }) {
  const agent = board.agents.find((a) => a.id === s.agentId);
  return (
    <>
      <div className="title">{s.label}</div>
      <Who name={agent?.name ?? "agent"} color={colorOf(s.agentId)} extra={elapsed(s.t, start)} />
      <p className="empty">{s.note}</p>
    </>
  );
}

function ActionDetail({ board, a, start, colorOf }: Props & { a: LooseAction }) {
  const agent = board.agents.find((x) => x.id === a.agentId);
  return (
    <>
      <div className="title">{a.label}</div>
      <Who name={agent?.name ?? "agent"} color={colorOf(a.agentId)} extra={elapsed(a.t, start)} />
      {a.tokens !== undefined ? <div className="meta">{kTokens(a.tokens)} tokens</div> : null}
      {a.file ? (
        <ul className="files" aria-label="File touched">
          <li title={a.file}>{a.file}</li>
        </ul>
      ) : null}
    </>
  );
}

/** Whatever was clicked on the board, as of time t: its kind for the popup's heading, and its detail. */
export function selectedDetail(props: Props): { kind: string; body: ReactNode } | null {
  const { board, selected, t } = props;
  if (selected === null) return null;
  const task =
    board.tasks.find((k) => k.id === selected) ??
    board.tasks.find((k) => k.actions.some((a) => a.id === selected));
  if (task && task.t0 <= t) return { kind: "Task", body: <TaskDetail {...props} k={task} /> };
  const goal = board.goals.find((g) => g.id === selected);
  if (goal && goal.t0 <= t) return { kind: "Goal", body: <GoalDetail {...props} g={goal} /> };
  const shared = board.shared.find((s) => s.id === selected);
  if (shared && shared.t <= t) {
    return {
      kind: shared.kind === "lesson" ? "Lesson" : "Decision",
      body: <SharedDetail {...props} s={shared} />,
    };
  }
  const action = board.loose.find((a) => a.id === selected);
  if (action && action.t <= t) return { kind: "Action", body: <ActionDetail {...props} a={action} /> };
  return null;
}
