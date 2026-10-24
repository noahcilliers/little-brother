import { useRef } from "react";
import { EVENTS, type EventType } from "./film-log";
import { clock } from "./film-math";

/** Bottom-right pane: the latest classified events, newest first. */
export function FilmTable({ t }: { t: number }) {
  const rows = EVENTS.filter(([at]) => at <= t);
  const prev = useRef({ count: rows.length, grew: false });
  if (prev.current.count !== rows.length)
    prev.current = { count: rows.length, grew: rows.length > prev.current.count };
  const count = (ty: EventType) => rows.filter((r) => r[3] === ty).length;
  return (
    <div className="pane p-table">
      <div className="ph">
        <span>activity → event types</span>
        <small>
          dup {count("duplicate")} · stale {count("stale")} · conflict {count("conflict")}
        </small>
      </div>
      <table className="ev">
        <colgroup>
          <col style={{ width: 72 }} />
          <col style={{ width: 62 }} />
          <col />
          <col style={{ width: 92 }} />
        </colgroup>
        <thead>
          <tr>
            <th>time</th>
            <th>agent</th>
            <th>event</th>
            <th>type</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .slice(-7)
            .reverse()
            .map(([at, who, sig, type], i) => (
              <tr key={at} className={prev.current.grew && i === 0 ? "enter" : ""}>
                <td className="t">{clock(at)}</td>
                <td className="a">{who}</td>
                <td>{sig}</td>
                <td>
                  <span className={`vt ${type}`}>{type}</span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
