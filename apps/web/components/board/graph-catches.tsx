import type { BoardCatch } from "@/lib/api";
import { anchor, catchOpacity, isOpen, type Lookup } from "@/lib/board-time";

type Props = { catches: BoardCatch[]; lookup: Lookup; t: number; selected: string | null };

/** Catches link the caught task to what it was caught against; drawn only while open, fading after. */
export function GraphCatches({ catches, lookup, t, selected }: Props) {
  return (
    <g>
      {catches.map((c) => {
        const opacity = catchOpacity(c, t, lookup.layout, selected);
        if (opacity === null) return null;
        const a = anchor(c.from, c.t, lookup);
        const b = anchor(c.to, c.t, lookup);
        if (!a || !b) return null;
        const open = isOpen(c, t);
        const conflict = c.kind === "conflict";
        const color = conflict ? "var(--hot)" : "var(--warn)";
        const mx = (a.x + b.x) / 2 + 40;
        return (
          <g key={c.id} opacity={opacity}>
            <path
              d={`M${a.x} ${a.y} Q${mx} ${(a.y + b.y) / 2} ${b.x} ${b.y}`}
              fill="none"
              stroke={color}
              strokeWidth={2.4}
              strokeDasharray={conflict ? "7 5" : "2 4"}
            >
              {open ? (
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-24"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              ) : null}
            </path>
            {open
              ? [a, b].map((p) => (
                  <circle
                    key={`${p.x}:${p.y}`}
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                  >
                    <animate attributeName="r" values="12;26" dur="1.3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0" dur="1.3s" repeatCount="indefinite" />
                  </circle>
                ))
              : null}
            <title>{c.text}</title>
          </g>
        );
      })}
    </g>
  );
}
