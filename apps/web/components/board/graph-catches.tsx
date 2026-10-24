import type { BoardCatch } from "@/lib/api";
import { anchor, type CatchKind, catchOpacity, isOpen, type Lookup } from "@/lib/board-time";
import { CATCH_STYLE, chipText } from "@/lib/catch-style";
import { CATCH_ICON, Icon } from "./icons";

type Props = {
  catches: BoardCatch[];
  lookup: Lookup;
  t: number;
  selected: string | null;
  highlight: CatchKind | null;
  /** A chip opens the caught task. */
  onSelect?: (id: string) => void;
};

/** A labelled chip at the middle of a catch edge: icon plus "conflict · auth.mechanism". */
function EdgeChip({
  c,
  x,
  y,
  color,
  width,
  onSelect,
}: {
  c: BoardCatch;
  x: number;
  y: number;
  color: string;
  width: number;
  onSelect?: (id: string) => void;
}) {
  const text = chipText(c);
  const w = 30 + text.length * 6.1;
  // Kept inside the graph so a catch near either end never loses half its chip.
  const left = Math.max(4, Math.min(x - w / 2, width - w - 4));
  const pick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(c.from);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>
    <g
      className="task"
      role="button"
      tabIndex={0}
      transform={`translate(${left} ${y - 10})`}
      onClick={pick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? pick(e) : undefined)}
    >
      <rect width={w} height={20} rx={10} fill="var(--panel)" stroke={color} strokeWidth={1.3} />
      <Icon name={CATCH_ICON[c.kind]} x={13} y={10} size={11} color={color} />
      <text x={24} y={14} fontFamily="var(--mono)" fontSize={10.5} fill="var(--ink)">
        {text}
      </text>
    </g>
  );
}

/** Catches link the caught task to what it was caught against; drawn while open, fading after. */
export function GraphCatches({ catches, lookup, t, selected, highlight, onSelect }: Props) {
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
                    stroke={style.color}
                    strokeWidth={2}
                  >
                    <animate attributeName="r" values="12;26" dur="1.3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0" dur="1.3s" repeatCount="indefinite" />
                  </circle>
                ))
              : null}
            {/* A settled catch rests as a faint edge; its chip comes back when selected or highlighted. */}
            {opacity > 0.5 ? (
              <EdgeChip
                c={c}
                x={cx}
                y={cy}
                color={style.color}
                width={lookup.layout.width}
                onSelect={onSelect}
              />
            ) : null}
            <title>{c.text}</title>
          </g>
        );
      })}
    </g>
  );
}
