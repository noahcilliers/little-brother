import { type AgentStatus, agentStatus, STATUS_LABEL } from "@/lib/agent-status";
import type { Board } from "@/lib/api";
import { BAR_H, type Layout, laneY } from "@/lib/board-layout";
import { Icon } from "./icons";

export const LABEL_W = 148;
/** The label column on a phone, where every pixel of graph counts. */
export const LABEL_W_COMPACT = 104;
const NAME_X = 14;

// Geist Mono is ~0.6em wide; at 12px a name may use the space left of the 24px status icon column.
function fit(name: string, width: number): string {
  const chars = Math.floor((width - NAME_X - 30) / 7.2);
  return name.length > chars ? `${name.slice(0, chars - 1)}…` : name;
}

function StatusIcon({
  status,
  color,
  y,
  width,
}: {
  status: AgentStatus;
  color: string;
  y: number;
  width: number;
}) {
  const x = width - 20;
  if (status === "decision") return <Icon name="bolt" x={x} y={y} size={15} color="var(--hot)" />;
  if (status === "working") return <Icon name="pulse" x={x} y={y} size={13} color={color} />;
  if (status === "blocked") return <Icon name="wall" x={x} y={y} size={13} color="var(--warn)" />;
  return <Icon name="idle" x={x} y={y} size={13} color="var(--faint)" />;
}

type Props = {
  board: Board;
  layout: Layout;
  t: number;
  focus: string | null;
  colorOf: (id: string) => string;
  width?: number;
};

/** The sticky left column: agent names with a one-icon status, and the band label under each row. */
export function RowLabels({ board, layout, t, focus, colorOf, width = LABEL_W }: Props) {
  return (
    <svg className="labels" width={width} height={layout.height} aria-hidden="true">
      {board.agents.map((a) => {
        const row = layout.rows.get(a.id);
        if (!row) return null;
        const y = laneY(row, 0);
        const status = agentStatus(board, a.id, t);
        return (
          <g key={a.id} opacity={focus && focus !== a.id ? 0.35 : 1}>
            <rect x={0} y={row.top} width={3} height={row.bottom - row.top} rx={1.5} fill={colorOf(a.id)} />
            <title>{`${a.name} · ${STATUS_LABEL[status]}`}</title>
            <text
              x={NAME_X}
              y={y + 4}
              fontFamily="var(--mono)"
              fontSize={12}
              fontWeight={500}
              fill={colorOf(a.id)}
            >
              {fit(a.name, width)}
            </text>
            <text
              x={NAME_X}
              y={y + BAR_H / 2 + 6}
              fontFamily="var(--mono)"
              fontSize={9.5}
              fill="var(--muted)"
            >
              {STATUS_LABEL[status]}
            </text>
            <StatusIcon status={status} color={colorOf(a.id)} y={y} width={width} />
            {row.band !== null ? (
              <text
                x={NAME_X}
                y={row.band + 3}
                fontFamily="var(--mono)"
                fontSize={9}
                fill="var(--muted)"
                letterSpacing="0.06em"
              >
                {width < LABEL_W ? "LEARNED" : "LEARNED · DECIDED"}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
