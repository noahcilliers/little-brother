import type { BoardCatch, BoardTask } from "@/lib/api";
import { BAR_H, type Layout } from "@/lib/board-layout";
import { barEnd, barTop, type CatchKind, stateAt } from "@/lib/board-time";
import { kTokens } from "@/lib/format";
import { CHAR_W, fitText, stickyX } from "@/lib/label-fit";
import { CatchBadges, catchesOf, catchOutline } from "./catch-badges";
import { ActionTicks, EndCap, TokenCount } from "./task-marks";

type Props = {
  k: BoardTask;
  /** Start of the next bar in the same lane, or the right edge: the room a label below the bar may use. */
  nextX: number;
  layout: Layout;
  t: number;
  color: string;
  catches: BoardCatch[];
  highlight: CatchKind | null;
  selected: boolean;
  dim: boolean;
  onSelect: (id: string) => void;
  /** Hovering a bar brings up its settled catch links. */
  onHover?: (id: string | null) => void;
  /** Left edge of the visible part of the graph: a bar that starts before it keeps its label in view. */
  viewLeft?: number;
};

const GREY_FILL = "color-mix(in srgb, var(--faint) 18%, transparent)";
const MIN_BELOW = 7;

/** One task: a bar over its real duration, action ticks, an end cap for its state, and badges for its catches. */
export function TaskBar({
  k,
  nextX,
  layout,
  t,
  color,
  catches,
  highlight,
  selected,
  dim,
  onSelect,
  onHover,
  viewLeft = 0,
}: Props) {
  const y = barTop(k, layout);
  if (y === undefined || t < k.t0) return null;
  const state = stateAt(k, t);
  const running = state === "running";
  const x0 = layout.xAt(k.t0);
  const x1 = layout.xAt(barEnd(k, t));
  const w = Math.max(6, x1 - x0);
  const superseded = state === "superseded";
  const grey = state === "abandoned" || superseded;
  const fill = grey
    ? GREY_FILL
    : `color-mix(in srgb, ${color} ${state === "stopped" ? 8 : 16}%, transparent)`;
  // Inside the bar when it fits; otherwise just below it, using the room up to the next task in the lane. Either
  // way the label starts at the bar's visible left edge, so a bar scrolled half out of view still reads.
  const inside = Math.floor((w - 26) / CHAR_W.bar) >= k.subject.length;
  const labelX = stickyX(x0, viewLeft, inside ? 8 : 2);
  const below = fitText(k.subject, nextX - labelX - 6, CHAR_W.below);
  // A stub like "ed…" under a row of short steps is noise; the bar's tooltip and popup carry the subject.
  const text = inside
    ? fitText(k.subject, x0 + w - labelX - 18, CHAR_W.bar)
    : below.length >= Math.min(k.subject.length, MIN_BELOW)
      ? below
      : "";
  const strike = superseded ? "line-through" : undefined;
  const mine = catchesOf(catches, k.id, t);
  const outline = catchOutline(mine);

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
      onMouseEnter={() => onHover?.(k.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {outline ? (
        <rect
          x={x0 - 4}
          y={y - 4}
          width={w + 8}
          height={BAR_H + 8}
          rx={10}
          fill="none"
          stroke={outline}
          strokeWidth={2}
        />
      ) : null}
      <rect
        className="tb"
        x={x0}
        y={y}
        width={w}
        height={BAR_H}
        rx={7}
        fill={fill}
        stroke={grey ? "var(--faint)" : color}
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
          x={labelX}
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
          x={labelX}
          y={y + BAR_H + 15}
          fontFamily="var(--sans)"
          fontSize={10.5}
          fill={grey ? "var(--faint)" : "var(--muted)"}
          textDecoration={strike}
        >
          {text}
        </text>
      )}
      <ActionTicks actions={k.actions} layout={layout} t={t} y={y + BAR_H} color={color} grey={grey} />
      <EndCap k={k} state={state} x1={x1} y={y} color={color} />
      <TokenCount k={k} state={state} x1={x1} y={y} room={nextX - x1} onHoverOnly={!inside} />
      {selected ? (
        <rect
          className="sel-ring"
          x={x0 - 2}
          y={y - 2}
          width={w + 4}
          height={BAR_H + 4}
          rx={9}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      ) : null}
      <CatchBadges items={mine} x={x0 + w - 2} y={y - 2} highlight={highlight} />
      <title>{k.tokens === undefined ? k.subject : `${k.subject} · ${kTokens(k.tokens)} tokens`}</title>
    </g>
  );
}
