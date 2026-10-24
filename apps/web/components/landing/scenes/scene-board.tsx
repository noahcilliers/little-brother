import "./scene-board.css";
import "./scene-board-motion.css";
import { Av } from "../mini";

const LANES = [
  {
    who: "ash",
    tasks: [
      ["cart api", 30, ""],
      ["checkout form", 34, "on hit"],
    ],
  },
  {
    who: "noah",
    tasks: [
      ["users table", 44, "hit"],
      ["auth", 24, "on"],
    ],
  },
  {
    who: "joshua",
    tasks: [
      ["stripe webhook", 38, ""],
      ["e2e tests", 28, "on"],
    ],
  },
] as const;

/** The live board in miniature: a playhead sweeps the lanes while catches pop up as toasts. */
export function SceneBoard() {
  return (
    <div className="sc sc-board">
      <div className="bd">
        <div className="bd-h">
          <b>checkout sprint</b>
          <span className="bd-sub">3 people · 3 agents</span>
          <span className="bd-live">
            <i /> live
          </span>
        </div>
        <div className="bd-body">
          <div className="bd-who">
            {LANES.map((l) => (
              <span key={l.who}>
                <Av who={l.who} />
                <span className="nm">{l.who}</span>
              </span>
            ))}
          </div>
          <div className="bd-tracks">
            {LANES.map((l) => (
              <span key={l.who} className="bd-track">
                {l.tasks.map(([name, w, cls]) => (
                  <i key={name} className={`t ${cls}`} style={{ width: `${w}%` }}>
                    {name}
                  </i>
                ))}
              </span>
            ))}
            <b className="now" />
          </div>
        </div>
        <div className="toasts">
          <p className="toast ta">
            <i /> duplicate caught · ash ↔ noah
          </p>
          <p className="toast tb">
            <i /> lesson saved · use vite proxy
          </p>
        </div>
      </div>
    </div>
  );
}
