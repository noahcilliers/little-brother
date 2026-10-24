import type { Board } from "@/lib/api";
import type { Layout } from "@/lib/board-layout";
import { heads } from "@/lib/board-view";
import { CrossEdges, TrajectoryEdges } from "./graph-edges";
import { GraphNodes } from "./graph-nodes";
import { Rings } from "./graph-rings";

type Props = {
  board: Board;
  layout: Layout;
  t: number;
  live: boolean;
  selected: string | null;
  focus: string | null;
  onSelect: (id: string | null) => void;
  colorOf: (agentId: string | null) => string;
};

const BAND_LABEL = { lesson: "LESSONS", decision: "DECISIONS" } as const;

/** Time runs left to right; one stream per agent, lessons and decisions in bands between them. */
export function BehaviorGraph({ board, layout, t, live, selected, focus, onSelect, colorOf }: Props) {
  const nodes = board.nodes.filter((n) => n.at <= t);
  const visible = new Set(nodes.map((n) => n.id));
  const dim = (agentId: string | null) => (focus && agentId && agentId !== focus ? 0.15 : 1);
  // A finished session's last step is history, not activity; only pulse heads of sessions still running.
  const running = new Set(board.agents.filter((a) => !live || a.status !== "offline").map((a) => a.id));
  const headNodes = [...heads(nodes).values()].filter((n) => n.agentId && running.has(n.agentId));
  const playX = layout.xAt(t);
  const { width, height } = layout;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ minWidth: width * 0.78 }}
      role="img"
      aria-label="Behavior graph of the agents"
      onClick={() => onSelect(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onSelect(null);
      }}
    >
      <line x1={playX} y1={30} x2={playX} y2={height - 15} className="playhead" />
      {layout.lanes.map((l) => (
        <g key={l.id} opacity={dim(l.id)}>
          <line x1={40} y1={l.y} x2={width - 30} y2={l.y} stroke="var(--line)" strokeDasharray="2 6" />
          <text x={12} y={l.y + 4} className="g-lane" fill={colorOf(l.id)}>
            {l.handle}
          </text>
        </g>
      ))}
      {layout.bands.map((b) => (
        <text key={b.key} x={12} y={b.y + 4} className="g-band">
          {BAND_LABEL[b.key]}
        </text>
      ))}
      <TrajectoryEdges nodes={nodes} layout={layout} t={t} colorOf={colorOf} dim={dim} />
      <CrossEdges nodes={nodes} edges={board.edges} layout={layout} t={t} colorOf={colorOf} dim={dim} />
      <Rings
        edges={board.edges}
        heads={headNodes}
        visible={visible}
        layout={layout}
        t={t}
        colorOf={colorOf}
      />
      <GraphNodes
        nodes={nodes}
        layout={layout}
        t={t}
        selected={selected}
        onSelect={onSelect}
        colorOf={colorOf}
        dim={dim}
      />
    </svg>
  );
}
