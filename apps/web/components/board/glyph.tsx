import type { Glyph, Why } from "@/lib/api";

type ShapeProps = {
  glyph: Glyph;
  x: number;
  y: number;
  color: string;
  label?: string;
  small?: boolean;
  /** Greyed: the agent backed out of this step. */
  faded?: boolean;
  why?: Why;
};

export function whyColor(why: Why | undefined): string {
  return why === "conflict" ? "var(--hot)" : "var(--warn)";
}

function hexagon(x: number, y: number, r: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
    })
    .join(" ");
}

function Caption({ x, y, text, strong }: { x: number; y: number; text: string; strong?: boolean }) {
  return (
    <text x={x} y={y} textAnchor="middle" className={strong ? "g-cap strong" : "g-cap"}>
      {text}
    </text>
  );
}

/** One node glyph, drawn at (x, y); shapes and sizes follow the approved prototype. */
export function Shape({ glyph, x, y, color, label = "", small = false, faded = false, why }: ShapeProps) {
  const s = small ? 0.62 : 1;
  switch (glyph) {
    case "intent": {
      const w = small ? 22 : label.length * 6.4 + 26;
      const h = small ? 12 : 26;
      return (
        <>
          <rect
            x={x - w / 2}
            y={y - h / 2}
            width={w}
            height={h}
            rx={h / 2}
            fill="var(--panel)"
            stroke={color}
            strokeWidth={1.8}
          />
          {small ? null : (
            <text x={x} y={y + 4} textAnchor="middle" className="g-pill">
              {label}
            </text>
          )}
        </>
      );
    }
    case "edit":
    case "ok": {
      const r = 8 * s;
      return (
        <>
          <circle cx={x} cy={y} r={r} fill={faded ? "var(--faint)" : color} />
          {glyph === "ok" ? (
            <path
              d={`M${x - 3.6 * s} ${y} l${2.6 * s} ${2.8 * s} l${4.6 * s} ${-5.4 * s}`}
              fill="none"
              stroke="var(--panel)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : null}
        </>
      );
    }
    case "superseded": {
      const r = 8 * s;
      return (
        <>
          <circle cx={x} cy={y} r={r} fill="var(--panel)" stroke="var(--faint)" strokeWidth={1.8} />
          <path
            d={`M${x - r - 3} ${y + r + 3} L${x + r + 3} ${y - r - 3}`}
            stroke="var(--muted)"
            strokeWidth={1.8}
          />
        </>
      );
    }
    case "fail": {
      const r = 7 * s;
      const k = r / 1.6;
      const c = faded ? "var(--faint)" : "var(--hot)";
      return (
        <>
          <circle cx={x} cy={y} r={r + 3} fill="var(--panel)" stroke={c} strokeWidth={1.5} />
          <path
            d={`M${x - k} ${y - k} L${x + k} ${y + k} M${x + k} ${y - k} L${x - k} ${y + k}`}
            stroke={c}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </>
      );
    }
    case "blocked": {
      const w = 10 * s;
      return (
        <path
          d={`M${x - w} ${y} L${x + w} ${y}`}
          stroke={whyColor(why)}
          strokeWidth={4 * s}
          strokeLinecap="round"
        />
      );
    }
    case "lesson": {
      return (
        <>
          <polygon points={hexagon(x, y, 11 * s)} fill="var(--panel)" stroke="var(--ink)" strokeWidth={1.6} />
          <path
            d={`M${x - 4 * s} ${y - 2 * s} h${8 * s} M${x - 4 * s} ${y + 2 * s} h${6 * s}`}
            stroke="var(--ink)"
            strokeWidth={1.4}
          />
          {small ? null : <Caption x={x} y={y + 26} text={label} />}
        </>
      );
    }
    case "decision": {
      const r = 12 * s;
      return (
        <>
          <path d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`} fill={color} />
          {small ? null : <Caption x={x} y={y + 28} text={label} strong />}
        </>
      );
    }
    case "verify": {
      const r = 14 * s;
      return (
        <>
          <circle cx={x} cy={y} r={r} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2} />
          <path
            d={`M${x - 5 * s} ${y} l${3.6 * s} ${3.8 * s} l${7 * s} ${-8 * s}`}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          {small ? null : <Caption x={x} y={y + 30} text={label} />}
        </>
      );
    }
  }
}

/** A glyph at icon size, for panels, rows and the legend. */
export function Icon({
  glyph,
  color,
  why,
  faded,
}: {
  glyph: Glyph;
  color: string;
  why?: Why;
  faded?: boolean;
}) {
  return (
    <svg viewBox="-12 -12 24 24" className="icon" aria-hidden="true">
      <Shape glyph={glyph} x={0} y={0} color={color} why={why} faded={faded} small />
    </svg>
  );
}
