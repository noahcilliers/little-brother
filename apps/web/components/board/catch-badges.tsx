import type { BoardCatch } from "@/lib/api";
import { type CatchKind, isOpen } from "@/lib/board-time";
import { CATCH_STYLE, chipText } from "@/lib/catch-style";
import { CATCH_ICON, Icon } from "./icons";

/** The catches a task is part of, as seen at t: open ones in their colour, settled ones grey. */
export function catchesOf(catches: BoardCatch[], id: string, t: number) {
  return catches
    .filter((c) => (c.from === id || c.to === id) && t >= c.t)
    .map((c) => ({ c, open: isOpen(c, t) }));
}

type Item = { c: BoardCatch; open: boolean };
type Props = { items: Item[]; x: number; y: number; highlight: CatchKind | null };

const describe = ({ c, open }: Item) => `${chipText(c)}${open ? "" : " (settled)"}`;

/**
 * One badge on a bar's top-right corner: the catch's icon when there is one, a count when there are several
 * (a row of overlapping circles on a short bar read as noise). The tooltip and the task popup list them all.
 */
export function CatchBadges({ items, x, y, highlight }: Props) {
  const first = items[0];
  if (!first) return null;
  // The badge takes the colour of what most needs attention: an open catch, then a highlighted kind.
  const lead = items.find((i) => i.open) ?? items.find((i) => i.c.kind === highlight) ?? first;
  const lit = lead.open || highlight === lead.c.kind;
  const color = lit ? CATCH_STYLE[lead.c.kind].color : "var(--faint)";
  const many = items.length > 1;
  const r = many && items.length > 9 ? 10 : 8.5;
  return (
    <g className={lead.open ? "badge pulse" : "badge"} transform={`translate(${x} ${y})`}>
      <circle r={r} fill="var(--panel)" stroke={color} strokeWidth={1.4} />
      {many ? (
        <text
          y={3.5}
          textAnchor="middle"
          fontFamily="var(--mono)"
          fontSize={10}
          fontWeight={600}
          fill={lit ? color : "var(--muted)"}
        >
          {items.length}
        </text>
      ) : (
        <Icon name={CATCH_ICON[lead.c.kind]} x={0} y={0} size={11} color={color} />
      )}
      <title>{items.map(describe).join("\n")}</title>
    </g>
  );
}

/** A matching outline around a bar while one of its catches is open. */
export function catchOutline(items: Item[]): string | undefined {
  const open = items.find((x) => x.open);
  return open ? CATCH_STYLE[open.c.kind].color : undefined;
}
