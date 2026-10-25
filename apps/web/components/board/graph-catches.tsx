import type { BoardCatch } from "@/lib/api";
import { anchor, type CatchFocus, catchOpacity, isOpen, type Lookup } from "@/lib/board-time";
import { CATCH_STYLE, chipText } from "@/lib/catch-style";
import { CATCH_ICON, Icon } from "./icons";

type Props = {
  catches: BoardCatch[];
  lookup: Lookup;
  t: number;
  /** Which settled catches to redraw: the selected or hovered task's, or the highlighted kind. */
  focus: CatchFocus;
  /** A chip opens the caught task. */
  onSelect?: (id: string) => void;
};

type Box = { left: number; top: number; w: number };
const CHIP_H = 20;

/** A labelled chip at the middle of a catch edge: icon plus "conflict · auth.mechanism". */
function EdgeChip({
  c,
  box,
  color,
  onSelect,
}: {
  c: BoardCatch;
  box: Box;
  color: string;
  onSelect?: (id: string) => void;
}) {
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
      transform={`translate(${box.left} ${box.top})`}
      onClick={pick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? pick(e) : undefined)}
    >
      <rect width={box.w} height={CHIP_H} rx={10} fill="var(--panel)" stroke={color} strokeWidth={1.3} />
      <Icon name={CATCH_ICON[c.kind]} x={13} y={10} size={11} color={color} />
      <text x={24} y={14} fontFamily="var(--mono)" fontSize={10.5} fill="var(--ink)">
        {chipText(c)}
      </text>
    </g>
  );
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.w + 4 && b.left < a.left + a.w + 4 && Math.abs(a.top - b.top) < CHIP_H + 2;

/**
 * Catches link the caught task to what it was caught against: drawn while open, fading once settled, and
 * redrawn only for the hovered or selected task. One solid weight for every kind; colour tells them apart.
 */
export function GraphCatches({ catches, lookup, t, focus, onSelect }: Props) {
  const width = lookup.layout.width;
  const edges = catches.flatMap((c) => {
    const opacity = catchOpacity(c, t, lookup.layout, focus);
    const a = anchor(c.from, c.t, lookup);
    const b = anchor(c.to, c.t, lookup);
    if (opacity === null || !a || !b) return [];
    const mx = (a.x + b.x) / 2 + 40;
    const my = (a.y + b.y) / 2;
    // The midpoint of the quadratic curve, where the chip sits; kept inside the graph at either end.
    const w = 30 + chipText(c).length * 6.1;
    const cx = (a.x + 2 * mx + b.x) / 4;
    const box = {
      left: Math.max(4, Math.min(cx - w / 2, width - w - 4)),
      top: (a.y + 2 * my + b.y) / 4 - 10,
      w,
    };
    return [{ c, a, b, mx, my, opacity, open: isOpen(c, t), box }];
  });
  // Chips never stack: open catches claim their spot first, and a chip that would cover another is left to
  // the edge's tooltip and the task popup.
  const placed: Box[] = [];
  const chipped = new Set<string>();
  for (const e of [...edges].sort((p, q) => Number(q.open) - Number(p.open))) {
    if (e.opacity <= 0.5 || placed.some((b) => overlaps(b, e.box))) continue;
    placed.push(e.box);
    chipped.add(e.c.id);
  }
  return (
    <g>
      {edges.map(({ c, a, b, mx, my, opacity, open, box }) => {
        const color = CATCH_STYLE[c.kind].color;
        return (
          <g key={c.id} opacity={opacity}>
            <path
              d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke={color}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
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
            {chipped.has(c.id) ? <EdgeChip c={c} box={box} color={color} onSelect={onSelect} /> : null}
            <title>{c.text}</title>
          </g>
        );
      })}
    </g>
  );
}
