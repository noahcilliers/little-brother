import { AXIS_TOP, type AxisBreak, type Layout } from "@/lib/board-layout";

function idleText(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m < 1
    ? `${Math.round(ms / 1000)} s idle`
    : m < 60
      ? `${m} min idle`
      : `${(m / 60).toFixed(1)} h idle`;
}

/** Two slanted strokes on the axis where an idle stretch was squeezed out. */
function Break({ b, top, bottom }: { b: AxisBreak; top: number; bottom: number }) {
  return (
    <g className="axis-break">
      <line
        x1={b.x}
        y1={top}
        x2={b.x}
        y2={bottom}
        stroke="var(--line)"
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <path
        d={`M${b.x - 5} ${bottom + 12} l4 -8 M${b.x + 1} ${bottom + 12} l4 -8`}
        stroke="var(--faint)"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <title>{idleText(b.idleMs)}</title>
    </g>
  );
}

/** The time grid behind everything: evenly spaced round times, and a break mark at each squeezed gap. */
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
      {layout.breaks.map((b) => (
        <Break key={`b${b.x}`} b={b} top={AXIS_TOP} bottom={bottom} />
      ))}
    </g>
  );
}

export function NowLine({ x, height }: { x: number; height: number }) {
  return (
    <line x1={x} y1={AXIS_TOP} x2={x} y2={height - 22} stroke="var(--ink)" strokeWidth={1.2} opacity={0.35} />
  );
}
