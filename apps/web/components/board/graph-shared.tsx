import type { BoardShared, VerifyBadge } from "@/lib/api";
import { anchor, type Lookup } from "@/lib/board-time";

type Props = {
  shared: BoardShared[];
  lookup: Lookup;
  t: number;
  colorOf: (agentId: string) => string;
  onSelect: (id: string) => void;
};

function hexagon(x: number, y: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${x + 11 * Math.cos(a)},${y + 11 * Math.sin(a)}`;
    })
    .join(" ");
}

/** Lessons (hexagons) and decisions (diamonds) in their bands, each tied back to the task it came from. */
export function GraphShared({ shared, lookup, t, colorOf, onSelect }: Props) {
  return (
    <g>
      {shared.map((n) => {
        if (t < n.t) return null;
        const at = anchor(n.id, n.t, lookup);
        if (!at) return null;
        const { x, y } = at;
        const from = n.fromTask ? anchor(n.fromTask, n.t, lookup) : undefined;
        const midY = from ? (from.y + y) / 2 : y;
        const select = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect(n.id);
        };
        return (
          <g key={n.id}>
            {from ? (
              <path
                d={`M${from.x} ${from.y} C${from.x} ${midY}, ${x} ${midY}, ${x} ${y}`}
                fill="none"
                stroke="var(--faint)"
                strokeWidth={1.2}
              />
            ) : null}
            {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button> */}
            <g
              className="task"
              role="button"
              tabIndex={0}
              onClick={select}
              onKeyDown={(e) => (e.key === "Enter" ? select(e) : undefined)}
            >
              {n.kind === "lesson" ? (
                <>
                  <polygon points={hexagon(x, y)} fill="var(--panel)" stroke="var(--ink)" strokeWidth={1.5} />
                  <path
                    d={`M${x - 4} ${y - 2} h8 M${x - 4} ${y + 2} h6`}
                    stroke="var(--ink)"
                    strokeWidth={1.3}
                  />
                  <text x={x + 18} y={y + 4} fontFamily="var(--mono)" fontSize={10.5} fill="var(--muted)">
                    {n.label}
                  </text>
                </>
              ) : (
                <>
                  <path
                    d={`M${x} ${y - 12} L${x + 12} ${y} L${x} ${y + 12} L${x - 12} ${y} Z`}
                    fill={colorOf(n.agentId)}
                  />
                  <text
                    x={x + 18}
                    y={y + 4}
                    fontFamily="var(--mono)"
                    fontSize={11}
                    fontWeight={500}
                    fill="var(--ink)"
                  >
                    {n.label}
                  </text>
                </>
              )}
              <title>{n.note}</title>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** `lb verify` results: a pill in the lessons band once the branches were merged and tested. */
export function VerifyBadges({
  verifies,
  lookup,
  t,
}: {
  verifies: VerifyBadge[];
  lookup: Lookup;
  t: number;
}) {
  const y = lookup.layout.bands.lessons + 28;
  return (
    <g>
      {verifies.map((v) => {
        if (t < v.t) return null;
        const x = Math.min(lookup.layout.xAt(v.t) - 28, lookup.layout.width - 160);
        const width = 44 + v.text.length * 6.6;
        return (
          <g key={v.id}>
            <rect x={x} y={y} width={width} height={30} rx={15} fill="var(--panel)" stroke="var(--line)" />
            {v.ok ? (
              <path
                d={`M${x + 16} ${y + 15} l4 4 l8 -9`}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : (
              <path
                d={`M${x + 16} ${y + 10} l9 9 M${x + 25} ${y + 10} l-9 9`}
                stroke="var(--hot)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
            <text x={x + 34} y={y + 19} fontFamily="var(--mono)" fontSize={11} fill="var(--ink)">
              {v.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
