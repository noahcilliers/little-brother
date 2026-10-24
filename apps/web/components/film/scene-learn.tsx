import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { LearnTree } from "./learn-tree";

// Scene 5: the self-improving loop, as the code does it today. Lessons come from failed trajectories
// (classify/lessons.ts), decisions label verdicts, the judge retrieves labelled examples, thresholds recalibrate
// (classify/calibrate.ts). The pair model is roadmap and says so.

const T0 = 48.8;
const STEP_S = 1.1;
// biome-ignore format: one loop station per row
const STATIONS: [name: string, how: string][] = [
  ["Act", "agents work; every step is classified"],
  ["Fail / Decide", "a trajectory fails, or a person picks Approve or Dismiss"],
  ["Lesson / Label", "failures distil into lessons; decisions label verdicts confirmed or false_positive"],
  ["Retrieve", "the judge pulls the nearest labelled verdicts as few-shot examples"],
  ["Better verdict", "per-relation thresholds recalibrate from labelled outcomes"],
];
const CX = 380;
const CY = 400;
const R = 230;

export function SceneLearn({ s }: { s: number }) {
  const active = s < T0 + 0.6 ? -1 : Math.floor((s - T0 - 0.6) / STEP_S) % STATIONS.length;
  const ring = prog(s, T0 + 0.2, 0.9);
  const current = STATIONS[active];
  return (
    <div className="fx-learn">
      <h2 className="fx-title">
        <span className="fh-mask">
          <span style={rise(prog(s, T0 - 0.2, 0.5))}>It gets better as your team works.</span>
        </span>
        <small style={{ opacity: prog(s, T0 + 0.3, 0.4) }}>
          Pruning reasoning trajectories, labelling verdicts, retrieving what was learned.
        </small>
      </h2>
      <div className="fx-learn-tree">
        <LearnTree s={s} />
      </div>
      <div className="fx-loop">
        <svg viewBox="0 0 760 800" aria-hidden="true">
          <circle
            cx={CX}
            cy={CY}
            r={R}
            pathLength={1}
            className="fx-ring"
            style={{ strokeDashoffset: 1 - ring }}
          />
          {STATIONS.map(([name], i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / STATIONS.length;
            const x = CX + R * Math.cos(a);
            const y = CY + R * Math.sin(a);
            const on = i === active;
            return (
              <g key={name} style={{ opacity: prog(s, T0 + 0.3 + i * 0.12, 0.3) }}>
                <circle cx={x} cy={y} r={on ? 70 : 60} className={on ? "fx-station on" : "fx-station"} />
                <text x={x} y={y + 5} textAnchor="middle" className="fx-station-name">
                  {name}
                </text>
              </g>
            );
          })}
          <text x={CX} y={CY - 6} textAnchor="middle" className="fx-loop-center">
            {current ? current[0] : ""}
          </text>
          <text x={CX} y={CY + 22} textAnchor="middle" className="fx-loop-sub">
            every verdict is logged with its outcome
          </text>
        </svg>
        <p className="fx-loop-how">{current ? current[1] : " "}</p>
        <p className="fx-roadmap" style={{ opacity: prog(s, T0 + 4.5, 0.4) }}>
          <b>next</b> distil the labels into a small, fast pair model · no fine-tuning needed today
        </p>
      </div>
    </div>
  );
}
