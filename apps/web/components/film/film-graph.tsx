import { EDGES, LANE_X, LANES, NODE_W, NODES } from "./film-graph-data";
import { lastBefore } from "./film-math";

/** Left pane: one lane per agent, nodes appearing as work happens, catch edges between them. */
export function FilmGraph({ t, focus }: { t: number; focus: Set<string> }) {
  const quiet = (id: string) => focus.size > 0 && !focus.has(id);
  return (
    <div className="pane p-graph">
      <svg className="g-svg" viewBox="0 0 740 560" aria-hidden="true">
        {EDGES.map((e) => {
          const mark = lastBefore(e.marks, t);
          const on = t >= e.at ? " on" : "";
          const q = focus.size > 0 && !e.ends.some((id) => focus.has(id)) ? " quiet" : "";
          return (
            <g key={e.id}>
              <path d={e.d} className={`edge ${mark ? mark[1] : e.cls}${on}${q}`} />
              {e.label ? (
                <text x={e.lx} y={e.ly} textAnchor="middle" className={`elabel${on}${q}`}>
                  {mark ? mark[2] : e.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {LANES.map(([name, sub], i) => (
        <div key={name}>
          <div className="lane-h" style={{ left: (LANE_X[i] ?? 0) - NODE_W / 2 }}>
            {name}
            <small>{sub}</small>
          </div>
          <div className="lane-line" style={{ left: LANE_X[i] }} />
        </div>
      ))}
      {NODES.map((n) => {
        const mark = lastBefore(n.marks, t);
        const cls = `node ${n.extra}${t >= n.at ? " on" : ""}${mark ? ` ${mark[1]}` : ""}${quiet(n.id) ? " quiet" : ""}`;
        return (
          <div key={n.id} className={cls} style={{ left: n.x, top: n.y }}>
            <div className="l1">
              <b>{n.verb}</b>
              {n.l1}
            </div>
            <div className="l2">{n.l2}</div>
            <span className="tag">{mark ? mark[2] : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
