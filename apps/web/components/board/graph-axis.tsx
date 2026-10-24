import type { BoardAgent, BoardGoal } from "@/lib/api";
import { AXIS_TOP, BAR_H, type Layout } from "@/lib/board-layout";

/** Time grid, row and band labels: the parts of the graph that do not change with t. */
export function GraphGrid({
  layout,
  agents,
  colorOf,
}: {
  layout: Layout;
  agents: BoardAgent[];
  colorOf: (id: string) => string;
}) {
  const bottom = layout.height - 18;
  return (
    <g>
      {layout.ticks.map((k) => (
        <g key={k.x}>
          <line x1={k.x} y1={AXIS_TOP} x2={k.x} y2={bottom} stroke="var(--line)" strokeWidth={1} />
          <text
            x={k.x}
            y={bottom + 10}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize={9.5}
            fill="var(--faint)"
          >
            {k.label}
          </text>
        </g>
      ))}
      {agents.map((a) => (
        <text
          key={a.id}
          x={14}
          y={(layout.rowY.get(a.id) ?? 0) + 4}
          fontFamily="var(--mono)"
          fontSize={12}
          fontWeight={500}
          fill={colorOf(a.id)}
        >
          {a.name}
        </text>
      ))}
      {(["lessons", "decisions"] as const).map((band) => (
        <text
          key={band}
          x={14}
          y={layout.bands[band] + 4}
          fontFamily="var(--mono)"
          fontSize={9.5}
          fill="var(--muted)"
          letterSpacing="0.06em"
        >
          {band.toUpperCase()}
        </text>
      ))}
    </g>
  );
}

type GoalsProps = {
  goals: BoardGoal[];
  layout: Layout;
  t: number;
  focus: string | null;
  colorOf: (id: string) => string;
};

/** Goals: a thin bracket above the row, from the prompt to the end of the work it led to. */
export function GraphGoals({ goals, layout, t, focus, colorOf }: GoalsProps) {
  return (
    <g>
      {goals.map((g) => {
        const row = layout.rowY.get(g.agentId);
        if (row === undefined || t < g.t0) return null;
        const x0 = layout.xAt(g.t0);
        const x1 = layout.xAt(g.t1 === null ? t : Math.min(t, g.t1));
        const y = row - BAR_H / 2 - 16;
        return (
          <g key={g.id} opacity={focus && focus !== g.agentId ? 0.15 : 1}>
            <path
              d={`M${x0} ${y + 6} V${y} H${Math.max(x0 + 4, x1)}`}
              fill="none"
              stroke={colorOf(g.agentId)}
              strokeWidth={1.2}
              opacity={0.6}
            />
            <text x={x0 + 6} y={y - 4} fontFamily="var(--sans)" fontSize={11} fill="var(--muted)">
              {g.label}
            </text>
            <title>{g.text}</title>
          </g>
        );
      })}
    </g>
  );
}

export function NowLine({ x, height }: { x: number; height: number }) {
  return (
    <line x1={x} y1={AXIS_TOP} x2={x} y2={height - 18} stroke="var(--ink)" strokeWidth={1.2} opacity={0.35} />
  );
}
