import type { Board, BoardTask } from "@/lib/api";
import { isOpen, stateAt, stateLabel, stopColor } from "@/lib/board-time";
import { CATCH_STYLE, chipText } from "@/lib/catch-style";
import { kTokens } from "@/lib/format";
import { CATCH_ICON, InlineIcon } from "./icons";
import { StoryList } from "./story-list";

export type DetailProps = {
  board: Board;
  t: number;
  start: number;
  colorOf: (agentId: string) => string;
  onOpenDecision: (id: string) => void;
};

/** Distinct files a task's actions touched, in the order it first touched them. */
function filesOf(k: BoardTask, t: number): string[] {
  const out = new Set<string>();
  for (const a of k.actions) if (a.t <= t && a.file) out.add(a.file);
  return [...out];
}

/** What a task did, step by step, which files it touched, its catches, and a way into a waiting decision. */
export function TaskDetail({ board, k, t, start, colorOf, onOpenDecision }: DetailProps & { k: BoardTask }) {
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
  const files = filesOf(k, t);
  return (
    <>
      <div className="title" title={k.subject}>
        {k.subject}
      </div>
      <div className="meta">
        <i className="who" style={{ background: colorOf(k.agentId) }} />
        {agent?.name ?? "agent"}
        {goal ? ` · ${goal.label}` : k.inferred ? " · goal inferred" : ""}
      </div>
      <div className="state-row">
        <span className="state" style={{ color }}>
          {stateLabel(k, state)}
        </span>
        {k.tokens !== undefined ? (
          <span className="meta">
            {kTokens(k.tokens)} tokens{state === "abandoned" || state === "superseded" ? " · wasted" : ""}
          </span>
        ) : null}
      </div>
      {k.note && state !== "running" && !pendingSupersede ? <p className="empty">{k.note}</p> : null}
      <StoryList lines={lines} start={start} />
      {files.length > 0 ? (
        <ul className="files" aria-label="Files touched">
          {files.map((f) => (
            <li key={f} title={f}>
              {f}
            </li>
          ))}
        </ul>
      ) : null}
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
