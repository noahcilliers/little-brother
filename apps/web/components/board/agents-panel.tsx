import type { Board } from "@/lib/api";
import { agentColor } from "@/lib/format";
import { Icon } from "./glyph";

type Props = {
  board: Board;
  t: number;
  now: number;
  live: boolean;
  focus: string | null;
  onFocus: (id: string | null) => void;
};

const PULSE_MS = 5000;
const STATE: Record<string, string> = {
  intent: "planning",
  edit: "editing",
  ok: "tests pass",
  fail: "failed",
  blocked: "steered away",
  superseded: "superseded",
};

export function AgentsPanel({ board, t, now, live, focus, onFocus }: Props) {
  return (
    <div className="card">
      <div className="h">Agents</div>
      {board.agents.map((a) => {
        const mine = board.nodes.filter((n) => n.agentId === a.id && n.at <= t && !n.band);
        const last = mine[mine.length - 1];
        const intent = [...mine].reverse().find((n) => n.glyph === "intent");
        const recent = live ? now - a.lastEventAt < PULSE_MS : mine.some((n) => t - n.at < PULSE_MS);
        const color = agentColor(a.color);
        return (
          <button
            key={a.id}
            type="button"
            className="agent"
            aria-pressed={focus === a.id}
            onClick={() => onFocus(focus === a.id ? null : a.id)}
          >
            <span className={recent ? "dot pulse" : "dot"} style={{ background: color, color }} />
            <span>
              <b>{a.handle}</b>
              <small>{intent?.label ?? a.intent ?? a.branch}</small>
            </span>
            <span title={last ? (STATE[last.glyph] ?? last.glyph) : a.status}>
              {last ? <Icon glyph={last.glyph} color={color} why={last.why} /> : null}
            </span>
          </button>
        );
      })}
      {board.agents.length === 0 ? (
        <p className="empty">No agents yet. Start a Claude Code session.</p>
      ) : null}
    </div>
  );
}
