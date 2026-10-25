// The pair model drawn as it runs: features in, boosted trees, calibrated relation scores, then a settle-or-
// escalate decision. Every stage's animation is keyed off the section's data-play (see pair-model.css).

const GROUPS: [cls: string, n: number][] = [
  ["g1", 26],
  ["g2", 16],
  ["g3", 8],
  ["g4", 12],
  ["g5", 10],
  ["g6", 12],
];
const GROUP_LABELS = [
  "kinds & verbs",
  "code overlap",
  "rename · signature",
  "meaning",
  "topic · failure",
  "retrieval",
];
const NODES: [number, number][] = [
  [80, 0],
  [40, 56],
  [120, 56],
  [20, 112],
  [60, 112],
  [100, 112],
  [140, 112],
];
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6],
];
// An example pair: two agents touching one file in disjoint places, which the model settles as compatible.
const BARS: [name: string, p: number][] = [
  ["overlap_compatible", 0.82],
  ["independent", 0.07],
  ["textual_conflict", 0.04],
  ["duplicate", 0.03],
  ["semantic_conflict", 0.02],
  ["ordering", 0.01],
];

function Tree({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g transform={`translate(${x},${y})`} className="pm-tree" style={{ animationDelay: `${i * 0.15}s` }}>
      {EDGES.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={NODES[a]?.[0]} y1={NODES[a]?.[1]} x2={NODES[b]?.[0]} y2={NODES[b]?.[1]} />
      ))}
      {NODES.map(([cx, cy], j) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={j > 2 ? 8 : 10} className={j > 2 ? "leaf" : "split"} />
      ))}
    </g>
  );
}

export function PairModelSvg() {
  let cell = 0;
  return (
    <svg
      viewBox="0 0 1160 470"
      className="pm-svg"
      role="img"
      aria-label="Pair model: 84 features, 60 boosted trees, calibrated relation scores, then settle or hand to the judge"
    >
      <text x="0" y="22" className="pm-h">
        84 features
      </text>
      <g transform="translate(0,40)">
        {GROUPS.map(([cls, n], gi) => (
          <g key={cls} className={`pm-group ${cls}`}>
            {Array.from({ length: n }, () => {
              const i = cell++;
              return (
                <rect
                  key={i}
                  x={0}
                  y={i * 4.2}
                  width={40}
                  height={3.2}
                  rx={1.2}
                  style={{ animationDelay: `${(i % 21) * 0.04}s` }}
                />
              );
            })}
            <text x={52} y={(cell - n / 2) * 4.2 + 5} className="pm-l">
              {GROUP_LABELS[gi]}
            </text>
          </g>
        ))}
      </g>
      <path d="M220 215 H270" className="pm-arrow" />

      <text x="290" y="22" className="pm-h">
        60 boosted trees
      </text>
      <g transform="translate(290,60)">
        <Tree x={0} y={0} i={0} />
        <Tree x={170} y={0} i={1} />
        <Tree x={85} y={160} i={2} />
        <text x={260} y={235} className="pm-l big">
          … ×60
        </text>
      </g>
      <path d="M640 215 H690" className="pm-arrow" />

      <text x="710" y="22" className="pm-h">
        calibrated p
      </text>
      <g transform="translate(710,50)">
        {BARS.map(([name, p], j) => (
          <g key={name} transform={`translate(0,${j * 30})`}>
            <rect width={170} height={16} rx={4} className="pm-track" />
            <rect
              width={Math.max(4, 170 * p)}
              height={16}
              rx={4}
              className={j === 0 ? "pm-bar top" : "pm-bar"}
              style={{ animationDelay: `${j * 0.06}s` }}
            />
            <text x={180} y={13} className="pm-l sm">
              {name}
            </text>
          </g>
        ))}
      </g>

      <path d="M800 228 V268" className="pm-arrow" />
      <g transform="translate(800,316)" className="pm-decide">
        <polygon points="0,-44 44,0 0,44 -44,0" />
        <text x={0} y={5} textAnchor="middle" className="pm-l sm strong">
          p ≥ τ
        </text>
      </g>
      <path d="M844 316 H900" className="pm-arrow ok" />
      <g transform="translate(906,290)" className="pm-out settled">
        <rect width={190} height={52} rx={10} />
        <text x={95} y={23} textAnchor="middle" className="pm-l strong">
          settled
        </text>
        <text x={95} y={42} textAnchor="middle" className="pm-l sm">
          ~0.07 ms
        </text>
      </g>
      <path d="M800 360 V396" className="pm-arrow judge" />
      <g transform="translate(703,402)" className="pm-out judge">
        <rect width={194} height={52} rx={10} />
        <text x={97} y={23} textAnchor="middle" className="pm-l strong">
          LLM judge
        </text>
        <text x={97} y={42} textAnchor="middle" className="pm-l sm">
          unsure · ~7 s, async
        </text>
      </g>
    </svg>
  );
}
