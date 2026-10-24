import { lerp, prog } from "./film-clock";
import { rise } from "./film-fx";

// Scene 4: the pipeline as a flow diagram. The edit path (top row) answers inside the hook; the judge runs async
// (bottom row) and its verdicts reach running sessions on their next step.

type Node = { id: string; x: number; y: number; title: string; sub: string; lit: number };
const NW = 280;
const NH = 100;
const T0 = 41.2;

// biome-ignore format: tabular scenario data
const NODES: Node[] = [
  { id: "hook", x: 140, y: 300, title: "Claude Code hooks", sub: "every prompt and tool call", lit: T0 },
  { id: "norm", x: 500, y: 300, title: "Normalize", sub: "on the laptop · lb connector", lit: T0 + 0.9 },
  { id: "rules", x: 860, y: 300, title: "Rules + stored verdicts", sub: "≤ 150 ms budget · edit path", lit: T0 + 1.7 },
  { id: "reply", x: 1220, y: 300, title: "Hook reply", sub: "allow · warn · deny, same step", lit: T0 + 2.5 },
  { id: "judge", x: 860, y: 600, title: "LLM judge", sub: "async · never on the edit path", lit: T0 + 4.2 },
  { id: "push", x: 1220, y: 600, title: "Pushed back", sub: "inbox → next hook reply · channel", lit: T0 + 5.1 },
];

// biome-ignore format: [from, to, starts drawing, dashed]
const EDGES: [d: string, s: number, async: boolean][] = [
  ["M420 350 H500", T0 + 0.5, false], ["M780 350 H860", T0 + 1.3, false], ["M1140 350 H1220", T0 + 2.1, false],
  ["M1360 300 C1360 170 280 170 280 300", T0 + 2.9, false],
  ["M640 400 V650 H860", T0 + 3.6, true], ["M1140 650 H1220", T0 + 4.7, true],
  ["M1360 700 C1360 820 280 820 280 400", T0 + 5.5, true],
];

const PACKETS: [from: [number, number], to: [number, number], s: number][] = [
  [[420, 350], [500, 350], T0 + 0.5], [[780, 350], [860, 350], T0 + 1.3], [[1140, 350], [1220, 350], T0 + 2.1],
  [[1140, 650], [1220, 650], T0 + 4.7],
];

export function SceneHow({ s }: { s: number }) {
  return (
    <div className="fx-how">
      <h2 className="fx-title">
        <span className="fh-mask">
          <span style={rise(prog(s, T0 - 0.2, 0.5))}>One check on every tool call.</span>
        </span>
        <small style={{ opacity: prog(s, T0 + 0.3, 0.4) }}>Fast path answers in the hook. The judge thinks in the background.</small>
      </h2>
      <svg viewBox="0 0 1600 900" className="fx-svg" aria-hidden="true">
        <rect x={110} y={250} width={1420} height={190} rx={18} className="fx-lane" style={{ opacity: prog(s, T0, 0.4) }} />
        <text x={130} y={276} className="fx-lane-label" style={{ opacity: prog(s, T0, 0.4) }}>
          EDIT PATH · &lt; 150 ms
        </text>
        <rect x={470} y={560} width={1060} height={190} rx={18} className="fx-lane async" style={{ opacity: prog(s, T0 + 3.4, 0.4) }} />
        <text x={490} y={586} className="fx-lane-label" style={{ opacity: prog(s, T0 + 3.4, 0.4) }}>
          ASYNC · SCHEDULED IN THE BACKEND
        </text>
        {EDGES.map(([d, at, async]) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            className={async ? "fx-edge async" : "fx-edge"}
            style={{ strokeDashoffset: 1 - prog(s, at, 0.5), opacity: s >= at ? 1 : 0 }}
          />
        ))}
        <text x={820} y={196} textAnchor="middle" className="fx-note" style={{ opacity: prog(s, T0 + 3.2, 0.4) }}>
          deny or warn lands in the same step: the agent never waits on a model
        </text>
        <text x={820} y={842} textAnchor="middle" className="fx-note" style={{ opacity: prog(s, T0 + 6, 0.4) }}>
          verdicts reach running sessions on their next step · the judge averaged ≈ 6.9 s, fully off the edit path
        </text>
        {PACKETS.map(([a, b, at]) => {
          const p = prog(s, at, 0.5);
          return p > 0 && p < 1 ? <circle key={at} cx={lerp(a[0], b[0], p)} cy={lerp(a[1], b[1], p)} r={7} className="fx-packet" /> : null;
        })}
        {NODES.map((n) => {
          const on = prog(s, n.lit, 0.35);
          return (
            <g key={n.id} style={{ opacity: 0.25 + on * 0.75 }}>
              <rect x={n.x} y={n.y} width={NW} height={NH} rx={14} className={on >= 1 ? "fx-node lit" : "fx-node"} />
              <text x={n.x + 22} y={n.y + 42} className="fx-node-title">
                {n.title}
              </text>
              <text x={n.x + 22} y={n.y + 70} className="fx-node-sub">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
