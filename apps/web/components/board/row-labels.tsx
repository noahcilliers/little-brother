import { type AgentStatus, agentStatus, STATUS_LABEL } from "@/lib/agent-status";
import type { Board } from "@/lib/api";
import { BAR_H, type Layout, laneY } from "@/lib/board-layout";
import { Icon } from "./icons";

export const LABEL_W = 120;

function StatusIcon({ status, color, y }: { status: AgentStatus; color: string; y: number }) {
  const x = LABEL_W - 18;
  if (status === "decision") return <Icon name="bolt" x={x} y={y} size={15} color="var(--hot)" />;
  if (status === "working") return <Icon name="pulse" x={x} y={y} size={13} color={color} />;
  if (status === "blocked") return <Icon name="wall" x={x} y={y} size={13} color="var(--warn)" />;
  return <Icon name="idle" x={x} y={y} size={13} color="var(--faint)" />;
}

type Props = { board: Board; layout: Layout; t: number; focus: string | null; colorOf: (id: string) => string };

/** The sticky left column: agent names with a one-icon status, and the band label under each row. */
export function RowLabels({ board, layout, t, focus, colorOf }: Props) {
  return (
    <svg className="labels" width={LABEL_W} height={layout.height} aria-hidden="true">
      {board.agents.map((a) => {
        const row = layout.rows.get(a.id);
        if (!row) return null;
        const y = laneY(row, 0);
        const status = agentStatus(board, a.id, t);
        return (
          <g key={a.id} opacity={focus && focus !== a.id ? 0.35 : 1}>
            <rect x={0} y={row.top} width={3} height={row.bottom - row.top} rx={1.5} fill={colorOf(a.id)} />
            <text x={14} y={y + 4} fontFamily="var(--mono)" fontSize={12} fontWeight={500} fill={colorOf(a.id)}>
              {a.name}
            </text>
            <text x={14} y={y + BAR_H / 2 + 6} fontFamily="var(--mono)" fontSize={9.5} fill="var(--muted)">
              {STATUS_LABEL[status]}
            </text>
            <StatusIcon status={status} color={colorOf(a.id)} y={y} />
            {row.band !== null ? (
              <text
                x={14}
                y={row.band + 3}
                fontFamily="var(--mono)"
                fontSize={9}
                fill="var(--muted)"
                letterSpacing="0.06em"
              >
                LEARNED · DECIDED
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
