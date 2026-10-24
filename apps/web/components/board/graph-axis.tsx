import { AXIS_TOP, type Layout } from "@/lib/board-layout";

/** The time grid behind everything. */
export function GraphGrid({ layout }: { layout: Layout }) {
  const bottom = layout.height - 22;
  return (
    <g>
      {layout.ticks.map((k) => (
        <g key={k.x}>
          <line x1={k.x} y1={AXIS_TOP} x2={k.x} y2={bottom} stroke="var(--line)" strokeWidth={1} />
          <text
            x={k.x}
            y={bottom + 12}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize={9.5}
            fill="var(--faint)"
          >
            {k.label}
          </text>
        </g>
      ))}
    </g>
  );
}

export function NowLine({ x, height }: { x: number; height: number }) {
  return (
    <line x1={x} y1={AXIS_TOP} x2={x} y2={height - 22} stroke="var(--ink)" strokeWidth={1.2} opacity={0.35} />
  );
}
