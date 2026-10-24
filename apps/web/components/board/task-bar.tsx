import type { BoardTask } from "@/lib/api";
import { BAR_H, type Layout } from "@/lib/board-layout";
import { barEnd, stateAt, stopColor } from "@/lib/board-time";

type Props = {
  k: BoardTask;
  /** Start of the next bar in the same row, or the right edge: the room a label below the bar may use. */
  nextX: number;
  layout: Layout;
  t: number;
  color: string;
  selected: boolean;
  dim: boolean;
  onSelect: (id: string) => void;
};

const GREY_FILL = "color-mix(in srgb, var(--faint) 18%, transparent)";

/** One task: a bar spanning its real duration, action ticks along the bottom edge, and an end cap for its state. */
export function TaskBar({ k, nextX, layout, t, color, selected, dim, onSelect }: Props) {
  const rowY = layout.rowY.get(k.agentId);
  if (rowY === undefined || t < k.t0) return null;
  const state = stateAt(k, t);
  const running = state === "running";
  const x0 = layout.xAt(k.t0);
  const x1 = layout.xAt(barEnd(k, t));
  const w = Math.max(6, x1 - x0);
  const y = rowY - BAR_H / 2;
  const superseded = state === "superseded";
  const grey = state === "abandoned" || superseded;
  const fill = grey
    ? GREY_FILL
    : `color-mix(in srgb, ${color} ${state === "stopped" ? 8 : 16}%, transparent)`;
  const stroke = grey ? "var(--faint)" : color;
  // Inside the bar when it fits; otherwise just below it, using the room up to the next task in the row.
  const inside = Math.floor((w - 26) / 6.4) >= k.subject.length;
  const below = Math.floor((nextX - x0 - 6) / 5.8);
  const text =
    inside || below >= k.subject.length ? k.subject : `${k.subject.slice(0, Math.max(3, below - 1))}…`;
  const strike = superseded ? "line-through" : undefined;

  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>; keyboard handling is below
    <g
      className="task"
      role="button"
      tabIndex={0}
      opacity={dim ? 0.15 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(k.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(k.id);
      }}
    >
      <rect
        className="tb"
        x={x0}
        y={y}
        width={w}
        height={BAR_H}
        rx={7}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={grey ? "5 4" : undefined}
      />
      {running ? (
        <rect
          x={x0}
          y={y}
          width={w}
          height={BAR_H}
          rx={7}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.6}
        >
          <animate attributeName="opacity" values="0.7;0.15;0.7" dur="1.2s" repeatCount="indefinite" />
        </rect>
      ) : null}
      {inside ? (
        <text
          x={x0 + 8}
          y={y + BAR_H / 2 + 4}
          fontFamily="var(--sans)"
          fontSize={11.5}
          fontWeight={500}
          fill={grey ? "var(--muted)" : "var(--ink)"}
          textDecoration={strike}
        >
          {text}
        </text>
      ) : (
        <text
          x={x0 + 2}
          y={y + BAR_H + 16}
          fontFamily="var(--sans)"
          fontSize={10.5}
          fill={grey ? "var(--faint)" : "var(--muted)"}
          textDecoration={strike}
        >
          {text}
        </text>
      )}
      {k.actions
        .filter((a) => a.t <= t)
        .map((a) => (
          <circle
            key={a.id}
            cx={layout.xAt(a.t)}
            cy={y + BAR_H}
            r={3}
            fill={grey ? "var(--faint)" : color}
            stroke="var(--panel)"
            strokeWidth={1.5}
          />
        ))}
      {state === "abandoned" ? (
        <g transform={`translate(${x1 + 10} ${y + BAR_H / 2})`}>
          <circle r={8} fill="var(--panel)" stroke="var(--hot)" strokeWidth={1.5} />
          <path
            d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5"
            stroke="var(--hot)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      ) : null}
      {state === "stopped" ? (
        <path
          d={`M${x1 + 3} ${y - 4} V${y + BAR_H + 4}`}
          stroke={stopColor(k)}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ) : null}
      {state === "done" ? (
        <path
          d={`M${x1 - 14} ${y + BAR_H / 2} l3.5 3.5 l6 -7`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ) : null}
      {selected ? (
        <rect
          x={x0 - 4}
          y={y - 4}
          width={w + 8}
          height={BAR_H + 8}
          rx={10}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={1.4}
          strokeDasharray="2 3"
        />
      ) : null}
      <title>{k.subject}</title>
    </g>
  );
}
