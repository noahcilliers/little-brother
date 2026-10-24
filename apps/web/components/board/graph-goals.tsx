import type { BoardGoal, BoardTask } from "@/lib/api";
import type { Layout } from "@/lib/board-layout";
import { stateAt } from "@/lib/board-time";
import { Icon } from "./icons";

type Props = {
  goals: BoardGoal[];
  tasks: BoardTask[];
  layout: Layout;
  t: number;
  focus: string | null;
  colorOf: (id: string) => string;
};

type GoalMark = "running" | "done" | "failed";

function markAt(g: BoardGoal, tasks: BoardTask[], t: number): GoalMark {
  if (g.t1 === null || t < g.t1) return "running";
  const last = tasks.filter((k) => k.goalId === g.id && k.t0 <= t).pop();
  const end = last ? stateAt(last, t) : "done";
  return end === "stopped" || end === "abandoned" ? "failed" : "done";
}

/**
 * Goals as regions: a tinted band behind the agent's row for the goal's duration, a flag pill with the goal at
 * its left edge and a status mark at its right. Consecutive goals of one agent alternate tint.
 */
export function GoalRegions({ goals, tasks, layout, t, focus, colorOf }: Props) {
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
        const pillW = 30 + g.label.length * 6.1;
        const pillY = row.top + 6;
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
            <rect
              x={x0 + 4}
              y={pillY}
              width={pillW}
              height={20}
              rx={10}
              fill="var(--panel)"
              stroke={`color-mix(in srgb, ${color} 55%, transparent)`}
            />
            <Icon name="flag" x={x0 + 16} y={pillY + 10} size={12} color={color} />
            <text
              x={x0 + 26}
              y={pillY + 14}
              fontFamily="var(--sans)"
              fontSize={11}
              fontWeight={500}
              fill="var(--ink)"
            >
              {g.label}
            </text>
            <g transform={`translate(${Math.max(x1 - 12, x0 + pillW + 16)} ${pillY + 10})`}>
              {mark === "running" ? <Icon name="pulse" x={0} y={0} size={11} color={color} /> : null}
              {mark === "done" ? <Icon name="check" x={0} y={0} size={13} color={color} /> : null}
              {mark === "failed" ? <Icon name="cross" x={0} y={0} size={12} color="var(--hot)" /> : null}
            </g>
            <title>{g.text}</title>
          </g>
        );
      })}
    </g>
  );
}
