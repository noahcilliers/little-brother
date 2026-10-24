import { lerp, prog } from "./film-clock";
import { rise } from "./film-fx";

// Scene 4: the pipeline as a flow diagram, kept to a few words a box. The top row answers inside the hook; the
// judge runs in the background and its verdict reaches the agent on its next step.

type Node = { id: string; x: number; y: number; title: string; sub: string; lit: number };
const NW = 300;
const NH = 110;
const T0 = 0.4;

// biome-ignore format: tabular scenario data
const NODES: Node[] = [
  { id: "act", x: 150, y: 320, title: "Agent acts", sub: "edit · write · run", lit: T0 },
  { id: "check", x: 650, y: 320, title: "Little Brother checks", sub: "rules · under 150 ms", lit: T0 + 1.1 },
  { id: "reply", x: 1150, y: 320, title: "Allow · warn · block", sub: "before the change lands", lit: T0 + 2.2 },
  { id: "judge", x: 650, y: 620, title: "AI judge", sub: "in the background", lit: T0 + 4.4 },
];

// biome-ignore format: [path, starts drawing, background]
const EDGES: [d: string, s: number, async: boolean][] = [
  ["M450 375 H650", T0 + 0.6, false], ["M950 375 H1150", T0 + 1.7, false],
  ["M1300 320 C1300 180 300 180 300 320", T0 + 2.8, false],
  ["M800 430 V620", T0 + 3.8, true], ["M650 675 H300 V430", T0 + 5, true],
];

const PACKETS: [from: [number, number], to: [number, number], s: number][] = [
  [[450, 375], [650, 375], T0 + 0.6],
  [[950, 375], [1150, 375], T0 + 1.7],
  [[800, 430], [800, 620], T0 + 3.8],
];

export function SceneHow({ s }: { s: number }) {
  return (
    <div className="fx-how">
      <h2 className="fx-title">
        <span className="fh-mask">
          <span style={rise(prog(s, T0 - 0.2, 0.5))}>Every tool call gets checked.</span>
        </span>
      </h2>
      <svg viewBox="0 0 1600 900" className="fx-svg" aria-hidden="true">
        <text
          x={800}
          y={196}
          textAnchor="middle"
          className="fx-lane-label"
          style={{ opacity: prog(s, T0 + 2.8, 0.4) }}
        >
          SAME STEP · NO WAITING ON A MODEL
        </text>
        <text x={310} y={714} className="fx-lane-label" style={{ opacity: prog(s, T0 + 5.2, 0.4) }}>
          BACK ON THE NEXT STEP
        </text>
        {EDGES.map(([d, at, async]) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            className={async ? "fx-edge async" : "fx-edge"}
            style={{ strokeDashoffset: 1 - prog(s, at, 0.6), opacity: s >= at ? 1 : 0 }}
          />
        ))}
        {PACKETS.map(([a, b, at]) => {
          const p = prog(s, at, 0.6);
          return p > 0 && p < 1 ? (
            <circle key={at} cx={lerp(a[0], b[0], p)} cy={lerp(a[1], b[1], p)} r={8} className="fx-packet" />
          ) : null;
        })}
        {NODES.map((n) => {
          const on = prog(s, n.lit, 0.4);
          return (
            <g key={n.id} style={{ opacity: 0.2 + on * 0.8 }}>
              <rect
                x={n.x}
                y={n.y}
                width={NW}
                height={NH}
                rx={16}
                className={on >= 1 ? "fx-node lit" : "fx-node"}
              />
              <text x={n.x + NW / 2} y={n.y + 50} textAnchor="middle" className="fx-node-title">
                {n.title}
              </text>
              <text x={n.x + NW / 2} y={n.y + 80} textAnchor="middle" className="fx-node-sub">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
