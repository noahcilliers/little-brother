import "./scene-prune.css";
import "./scene-prune-motion.css";

type NodeBox = { x: number; y: number; w: number; text: string; cls: string };

const NODES: NodeBox[] = [
  { x: 6, y: 86, w: 108, text: "fix CORS /api", cls: "root" },
  { x: 136, y: 30, w: 122, text: "cors middleware", cls: "pa fail" },
  { x: 284, y: 30, w: 92, text: "✕ still 403", cls: "pa1 fail" },
  { x: 246, y: 86, w: 130, text: "lesson: vite proxy", cls: "lesson" },
  { x: 136, y: 142, w: 122, text: "vite proxy /api", cls: "pb" },
  { x: 284, y: 142, w: 92, text: "✓ tests pass", cls: "pb1" },
];

const EDGES = [
  ["e1 fail", "M114 100 C 126 100, 124 44, 136 44"],
  ["e2 fail", "M258 44 L284 44"],
  ["e3 dashed", "M330 58 L330 86"],
  ["e4 dashed", "M262 114 C 262 130, 240 128, 240 142"],
  ["e5 good", "M114 100 C 126 100, 124 156, 136 156"],
  ["e6 good", "M258 156 L284 156"],
] as const;

/** A reasoning tree: one branch dies, its lesson is kept, and the next agent's path bends around it. */
export function ScenePrune() {
  return (
    <div className="sc sc-prune">
      <svg viewBox="0 0 380 190" className="tree" aria-hidden="true">
        <text x="136" y="22" className="cap">
          first agent
        </text>
        <text x="136" y="134" className="cap">
          next agent
        </text>
        {EDGES.map(([cls, d]) => (
          <path key={cls} className={`edge ${cls}`} d={d} pathLength={1} />
        ))}
        {NODES.map((n) => (
          <g key={n.cls} className={`nd ${n.cls}`}>
            <rect x={n.x} y={n.y} width={n.w} height={28} rx={5} />
            <text x={n.x + 9} y={n.y + 18}>
              {n.text}
            </text>
          </g>
        ))}
        <path className="strike" d="M144 44 L250 44" pathLength={1} />
      </svg>
    </div>
  );
}
