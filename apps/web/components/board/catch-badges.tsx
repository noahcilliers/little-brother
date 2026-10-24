import type { BoardCatch } from "@/lib/api";
import { type CatchKind, isOpen } from "@/lib/board-time";
import { CATCH_STYLE } from "@/lib/catch-style";
import { CATCH_ICON, Icon } from "./icons";

/** The catches a task is part of, as seen at t: open ones in their colour, settled ones grey. */
export function catchesOf(catches: BoardCatch[], id: string, t: number) {
  return catches
    .filter((c) => (c.from === id || c.to === id) && t >= c.t)
    .map((c) => ({ c, open: isOpen(c, t) }));
}

type Props = { items: { c: BoardCatch; open: boolean }[]; x: number; y: number; highlight: CatchKind | null };

/** Chips on a bar's top-right corner, one per catch; open ones pulse once a second. */
export function CatchBadges({ items, x, y, highlight }: Props) {
  return (
    <g>
      {items.map(({ c, open }, i) => {
        const style = CATCH_STYLE[c.kind];
        const lit = open || highlight === c.kind;
        const color = lit ? style.color : "var(--faint)";
        return (
          <g key={c.id} className={open ? "badge pulse" : "badge"} transform={`translate(${x - i * 19} ${y})`}>
            <circle r={8.5} fill="var(--panel)" stroke={color} strokeWidth={1.4} />
            <Icon name={CATCH_ICON[c.kind]} x={0} y={0} size={11} color={color} />
            <title>{`${c.chip}${open ? "" : " (settled)"}`}</title>
          </g>
        );
      })}
    </g>
  );
}

/** A matching outline around a bar while one of its catches is open. */
export function catchOutline(items: { c: BoardCatch; open: boolean }[]): string | undefined {
  const open = items.find((x) => x.open);
  return open ? CATCH_STYLE[open.c.kind].color : undefined;
}
