import type { ReactNode } from "react";

// Small line icons drawn in a 16 x 16 box centred on 0,0, coloured from tokens. Used inside the graph SVG and,
// through InlineIcon, in HTML (top bar, legend, panels).

export type IconName =
  | "bolt"
  | "squares"
  | "retry"
  | "arrowBar"
  | "swap"
  | "flag"
  | "wall"
  | "check"
  | "cross"
  | "idle"
  | "pulse"
  | "hexagon"
  | "diamond";

const line = (d: string, color: string, width = 1.7) => (
  <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
);

function glyph(name: IconName, color: string): ReactNode {
  switch (name) {
    case "bolt":
      return <path d="M1.8 -7.2 L-4.6 1 H-0.4 L-1.8 7.2 L4.6 -1 H0.4 Z" fill={color} />;
    case "squares":
      return (
        <>
          <rect
            x={-6.5}
            y={-6.5}
            width={8.5}
            height={8.5}
            rx={1.5}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
          />
          <rect
            x={-2}
            y={-2}
            width={8.5}
            height={8.5}
            rx={1.5}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
          />
        </>
      );
    case "retry":
      return (
        <>
          {line("M5.6 1.2 A5.6 5.6 0 1 1 3.6 -4.2", color)}
          {line("M4.4 -7.4 L4 -3.8 L0.4 -4.4", color)}
        </>
      );
    case "arrowBar":
      return (
        <>
          {line("M-6.5 0 H3", color)}
          {line("M-0.5 -3.6 L3.2 0 L-0.5 3.6", color)}
          {line("M6.5 -6 V6", color, 2)}
        </>
      );
    case "swap":
      return (
        <>
          {line("M-6 -3 H5 M2 -6 L5 -3 L2 0", color)}
          {line("M6 3 H-5 M-2 0 L-5 3 L-2 6", color)}
        </>
      );
    case "flag":
      return (
        <>
          {line("M-4.5 7 V-7", color, 1.6)}
          <path d="M-4.5 -6.5 H5.5 L3 -3 L5.5 0.5 H-4.5 Z" fill={color} />
        </>
      );
    case "wall":
      return <rect x={-2} y={-7} width={4} height={14} rx={1.2} fill={color} />;
    case "check":
      return line("M-5 0.5 L-1.5 4 L5.5 -4", color, 2);
    case "cross":
      return line("M-4 -4 L4 4 M4 -4 L-4 4", color, 2);
    case "idle":
      return <circle r={4.5} fill="none" stroke={color} strokeWidth={1.6} />;
    case "pulse":
      return (
        <>
          <circle r={4} fill={color} />
          <circle r={4} fill="none" stroke={color} strokeWidth={1.5}>
            <animate attributeName="r" values="4;8" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </>
      );
    case "hexagon":
      return (
        <polygon
          points={[0, 1, 2, 3, 4, 5]
            .map(
              (i) =>
                `${6.5 * Math.cos((Math.PI / 3) * i + Math.PI / 6)},${6.5 * Math.sin((Math.PI / 3) * i + Math.PI / 6)}`,
            )
            .join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      );
    case "diamond":
      return <path d="M0 -7 L7 0 L0 7 L-7 0 Z" fill={color} />;
  }
}

/** An icon inside an SVG, centred at x,y; size is the box edge in px. */
export function Icon({
  name,
  x,
  y,
  size = 16,
  color,
}: {
  name: IconName;
  x: number;
  y: number;
  size?: number;
  color: string;
}) {
  return <g transform={`translate(${x} ${y}) scale(${size / 16})`}>{glyph(name, color)}</g>;
}

/** The same icon as an inline HTML element. */
export function InlineIcon({ name, color, size = 14 }: { name: IconName; color: string; size?: number }) {
  return (
    <svg viewBox="-8 -8 16 16" width={size} height={size} className="icon" aria-hidden="true">
      {glyph(name, color)}
    </svg>
  );
}

export const CATCH_ICON = {
  conflict: "bolt",
  duplicate: "squares",
  stale: "retry",
  ordering: "arrowBar",
  takeover: "swap",
} as const satisfies Record<string, IconName>;
