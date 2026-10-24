import type { BoardTask } from "@/lib/api";
import { BAR_H, type Layout } from "@/lib/board-layout";
import { type BarState, stopColor } from "@/lib/board-time";

/** Action ticks along a bar's bottom edge: agent colour for real work, small grey dots for routine steps. */
export function ActionTicks({
  actions,
  layout,
  t,
  y,
  color,
  grey,
}: {
  actions: BoardTask["actions"];
  layout: Layout;
  t: number;
  y: number;
  color: string;
  grey: boolean;
}) {
  return (
    <g>
      {actions
        .filter((a) => a.t <= t)
        .map((a) => (
          <g key={a.id} className="tick">
            {/* A wider invisible target so the hover label is easy to reach. */}
            <circle cx={layout.xAt(a.t)} cy={y} r={6} fill="transparent" />
            <circle
              cx={layout.xAt(a.t)}
              cy={y}
              r={a.routine ? 2.2 : 3}
              fill={a.routine ? "var(--faint)" : grey ? "var(--faint)" : color}
              stroke="var(--panel)"
              strokeWidth={a.routine ? 1 : 1.5}
            />
            <title>{a.file ? `${a.label} · ${a.file}` : a.label}</title>
          </g>
        ))}
    </g>
  );
}

/** The end of a bar says how it ended: ✕ abandoned, a wall when stopped, a check when done. */
export function EndCap({ k, state, x1, y, color }: { k: BoardTask; state: BarState; x1: number; y: number; color: string }) {
  if (state === "abandoned") {
    return (
      <g transform={`translate(${x1 + 10} ${y + BAR_H / 2})`}>
        <circle r={8} fill="var(--panel)" stroke="var(--hot)" strokeWidth={1.5} />
        <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" stroke="var(--hot)" strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  }
  if (state === "stopped") {
    return <path d={`M${x1 + 3} ${y - 4} V${y + BAR_H + 4}`} stroke={stopColor(k)} strokeWidth={4} strokeLinecap="round" />;
  }
  if (state === "done") {
    return (
      <path
        d={`M${x1 - 14} ${y + BAR_H / 2} l3.5 3.5 l6 -7`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }
  return null;
}
