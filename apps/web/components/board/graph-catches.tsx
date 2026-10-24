import type { BoardCatch } from "@/lib/api";
import { anchor, type CatchKind, catchOpacity, isOpen, type Lookup } from "@/lib/board-time";
import { CATCH_STYLE } from "@/lib/catch-style";
import { CATCH_ICON, Icon } from "./icons";

type Props = {
  catches: BoardCatch[];
  lookup: Lookup;
  t: number;
  selected: string | null;
  highlight: CatchKind | null;
};

/** A labelled chip at the middle of a catch edge: icon plus "conflict · auth.mechanism". */
function EdgeChip({ c, x, y, color }: { c: BoardCatch; x: number; y: number; color: string }) {
  const w = 30 + c.chip.length * 6.1;
  return (
    <g transform={`translate(${x - w / 2} ${y - 10})`}>
      <rect width={w} height={20} rx={10} fill="var(--panel)" stroke={color} strokeWidth={1.3} />
      <Icon name={CATCH_ICON[c.kind]} x={13} y={10} size={11} color={color} />
      <text x={24} y={14} fontFamily="var(--mono)" fontSize={10.5} fill="var(--ink)">
        {c.chip}
      </text>
    </g>
  );
}

/** Catches link the caught task to what it was caught against; drawn while open, fading after. */
export function GraphCatches({ catches, lookup, t, selected, highlight }: Props) {
  return (
    <g>
      {catches.map((c) => {
        const opacity = catchOpacity(c, t, lookup.layout, selected, highlight);
        if (opacity === null) return null;
        const a = anchor(c.from, c.t, lookup);
        const b = anchor(c.to, c.t, lookup);
        if (!a || !b) return null;
        const open = isOpen(c, t);
        const style = CATCH_STYLE[c.kind];
        const mx = (a.x + b.x) / 2 + 40;
        const my = (a.y + b.y) / 2;
        // The midpoint of the quadratic curve, where the chip sits.
        const cx = (a.x + 2 * mx + b.x) / 4;
        const cy = (a.y + 2 * my + b.y) / 4;
        return (
          <g key={c.id} opacity={opacity}>
            <path
              d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke={style.color}
              strokeWidth={2.4}
              strokeDasharray={style.dash}
            >
              {open ? (
                <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.9s" repeatCount="indefinite" />
              ) : null}
            </path>
            {open
              ? [a, b].map((p) => (
                  <circle key={`${p.x}:${p.y}`} cx={p.x} cy={p.y} r={14} fill="none" stroke={style.color} strokeWidth={2}>
                    <animate attributeName="r" values="12;26" dur="1.3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0" dur="1.3s" repeatCount="indefinite" />
                  </circle>
                ))
              : null}
            <EdgeChip c={c} x={cx} y={cy} color={style.color} />
            <title>{c.text}</title>
          </g>
        );
      })}
    </g>
  );
}
