import type { BoardShared } from "@/lib/api";
import { anchor, type Lookup } from "@/lib/board-time";

type Props = {
  shared: BoardShared[];
  lookup: Lookup;
  t: number;
  colorOf: (agentId: string) => string;
  /** Inline text per marker, already cut so neighbours never overlap; empty leaves the marker alone. */
  labels: Map<string, string>;
  /** The marker whose full text is showing; it keeps its link to the task it came from lit. */
  active: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

function hexagon(x: number, y: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${x + 9 * Math.cos(a)},${y + 9 * Math.sin(a)}`;
    })
    .join(" ");
}

/**
 * Lessons (hexagons) and decisions (diamonds) in their bands, each tied back to the task it came from. A label
 * only shows where it fits before the next marker; hovering or selecting a marker floats its full text.
 */
export function GraphShared({ shared, lookup, t, colorOf, labels, active, onSelect, onHover }: Props) {
  return (
    <g>
      {shared.map((n) => {
        if (t < n.t) return null;
        const at = anchor(n.id, n.t, lookup);
        if (!at) return null;
        const { x, y } = at;
        const text = labels.get(n.id) ?? "";
        const from = n.fromTask ? anchor(n.fromTask, n.t, lookup) : undefined;
        const midY = from ? (from.y + y) / 2 : y;
        const select = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect(n.id);
        };
        const lesson = n.kind === "lesson";
        return (
          <g key={n.id}>
            {from ? (
              <path
                d={`M${from.x} ${from.y} C${from.x} ${midY}, ${x} ${midY}, ${x} ${y}`}
                fill="none"
                stroke={active === n.id ? "var(--muted)" : "var(--faint)"}
                strokeWidth={1.2}
              />
            ) : null}
            {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button> */}
            <g
              className="task"
              role="button"
              tabIndex={0}
              aria-label={`${n.kind}: ${n.label}`}
              onClick={select}
              onKeyDown={(e) => (e.key === "Enter" ? select(e) : undefined)}
              onMouseEnter={() => onHover(n.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(n.id)}
              onBlur={() => onHover(null)}
            >
              {/* A wider hit area than the 18 px marker, so the card is easy to bring up. */}
              <circle cx={x} cy={y} r={13} fill="transparent" />
              {lesson ? (
                <>
                  <polygon points={hexagon(x, y)} fill="var(--panel)" stroke="var(--ink)" strokeWidth={1.5} />
                  <path
                    d={`M${x - 3.5} ${y - 2} h7 M${x - 3.5} ${y + 2} h5`}
                    stroke="var(--ink)"
                    strokeWidth={1.3}
                  />
                </>
              ) : (
                <path
                  d={`M${x} ${y - 10} L${x + 10} ${y} L${x} ${y + 10} L${x - 10} ${y} Z`}
                  fill={colorOf(n.agentId)}
                />
              )}
              {text ? (
                <text
                  x={x + 15}
                  y={y + 4}
                  fontFamily="var(--mono)"
                  fontSize={lesson ? 10.5 : 11}
                  fontWeight={lesson ? 400 : 500}
                  fill={lesson ? "var(--muted)" : "var(--ink)"}
                >
                  {text}
                </text>
              ) : null}
            </g>
          </g>
        );
      })}
    </g>
  );
}
