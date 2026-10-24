import type { Board } from "@/lib/api";
import { elapsed } from "@/lib/format";
import { Icon, whyColor } from "./glyph";

type Props = {
  board: Board;
  t: number;
  start: number;
  onSelect: (id: string) => void;
  colorOf: (agentId: string | null) => string;
};

const ROWS = 8;
const TAG = { duplicate: "duplicate", stale: "stale", conflict: "conflict" } as const;

export function EventsPanel({ board, t, start, onSelect, colorOf }: Props) {
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  const rows = board.feed.filter((r) => r.at <= t).slice(0, ROWS);
  return (
    <div className="card">
      <div className="h">Events</div>
      {rows.length === 0 ? (
        <p className="empty">Nothing yet.</p>
      ) : (
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="enter">
                <td className="t">{elapsed(r.at, start)}</td>
                <td>
                  <Icon glyph={r.glyph} color={colorOf(byId.get(r.nodeId)?.agentId ?? null)} why={r.tag} />
                </td>
                <td className="l">
                  <button type="button" onClick={() => onSelect(r.nodeId)}>
                    {r.label}
                  </button>
                </td>
                <td>
                  {r.tag ? (
                    <span className="tag" style={{ color: whyColor(r.tag) }}>
                      {TAG[r.tag]}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
