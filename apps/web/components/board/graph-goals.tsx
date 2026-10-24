import type { BoardGoal, BoardTask } from "@/lib/api";
import type { Layout } from "@/lib/board-layout";
import { stateAt } from "@/lib/board-time";
import { CHAR_W, fitText } from "@/lib/label-fit";
import { Icon } from "./icons";

type Props = {
  goals: BoardGoal[];
  tasks: BoardTask[];
  layout: Layout;
  t: number;
  focus: string | null;
  colorOf: (id: string) => string;
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** Left edge of the visible graph: a goal that began before it keeps its pill in view. */
  viewLeft?: number;
};

type GoalMark = "running" | "done" | "failed";

// Pill: 26 px for the flag before the text, 8 px after it; the status mark needs 16 px beside the pill.
const PILL_PAD = 34;
const MARK_W = 16;

function markAt(g: BoardGoal, tasks: BoardTask[], t: number): GoalMark {
  if (g.t1 === null || t < g.t1) return "running";
  const last = tasks.filter((k) => k.goalId === g.id && k.t0 <= t).pop();
  const end = last ? stateAt(last, t) : "done";
  return end === "stopped" || end === "abandoned" ? "failed" : "done";
}

/**
 * Goals as regions: a tinted band behind the agent's row for the goal's duration, a flag pill with the goal at
 * its visible left edge and a status mark at its right. Consecutive goals of one agent alternate tint.
 */
export function GoalRegions({
  goals,
  tasks,
  layout,
  t,
  focus,
  colorOf,
  selected,
  onSelect,
  viewLeft = 0,
}: Props) {
  const nth = new Map<string, number>();
  return (
    <g>
      {goals.map((g) => {
        const i = nth.get(g.agentId) ?? 0;
        nth.set(g.agentId, i + 1);
        const row = layout.rows.get(g.agentId);
        if (!row || t < g.t0) return null;
        const color = colorOf(g.agentId);
        const x0 = layout.xAt(g.t0);
        const x1 = Math.max(x0 + 24, layout.xAt(g.t1 === null ? t : Math.min(t, g.t1)));
        const mark = markAt(g, tasks, t);
        // The pill slides with the viewport's left edge while the region runs underneath, and its text is cut
        // to the region's visible width so it never spills into the next goal.
        const left = Math.min(Math.max(x0, viewLeft), Math.max(x0, x1 - 60));
        const label = fitText(g.label || g.text, x1 - left - 8 - PILL_PAD - MARK_W, CHAR_W.pill);
        const pillX = left + 4;
        const pillW = label ? PILL_PAD + label.length * CHAR_W.pill : 22;
        const pillY = row.top + 6;
        const pick = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect?.(g.id);
        };
        return (
          <g key={g.id} opacity={focus && focus !== g.agentId ? 0.2 : 1}>
            <rect
              x={x0}
              y={row.top}
              width={x1 - x0}
              height={row.bottom - row.top}
              rx={8}
              fill={`color-mix(in srgb, ${color} ${i % 2 ? 11 : 6}%, transparent)`}
              stroke={`color-mix(in srgb, ${color} 22%, transparent)`}
            />
            {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button> */}
            <g
              className="task"
              role="button"
              tabIndex={0}
              onClick={pick}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? pick(e) : undefined)}
            >
              <rect
                x={pillX}
                y={pillY}
                width={pillW}
                height={20}
                rx={10}
                fill="var(--panel)"
                stroke={selected === g.id ? "var(--ink)" : `color-mix(in srgb, ${color} 55%, transparent)`}
                strokeWidth={selected === g.id ? 1.5 : 1}
              />
              <Icon name="flag" x={pillX + 11} y={pillY + 10} size={12} color={color} />
              {label ? (
                <text
                  x={pillX + 22}
                  y={pillY + 14}
                  fontFamily="var(--sans)"
                  fontSize={11}
                  fontWeight={500}
                  fill="var(--ink)"
                >
                  {label}
                </text>
              ) : null}
              <title>{g.text}</title>
            </g>
            <g transform={`translate(${Math.max(x1 - 12, pillX + pillW + 10)} ${pillY + 10})`}>
              {mark === "running" ? <Icon name="pulse" x={0} y={0} size={11} color={color} /> : null}
              {mark === "done" ? <Icon name="check" x={0} y={0} size={13} color={color} /> : null}
              {mark === "failed" ? <Icon name="cross" x={0} y={0} size={12} color="var(--hot)" /> : null}
            </g>
          </g>
        );
      })}
    </g>
  );
}
