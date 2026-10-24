import type { BoardNode } from "@/lib/api";
import type { Layout } from "@/lib/board-layout";
import { Shape } from "./glyph";

type Props = {
  nodes: BoardNode[];
  layout: Layout;
  t: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  colorOf: (agentId: string | null) => string;
  dim: (agentId: string | null) => number;
};

export function GraphNodes({ nodes, layout, t, selected, onSelect, colorOf, dim }: Props) {
  return (
    <>
      {nodes.map((n) => {
        const p = layout.pos.get(n.id);
        if (!p) return null;
        const faded = n.abandoned && t >= (layout.abandonAt.get(n.id) ?? Number.POSITIVE_INFINITY);
        const pick = () => onSelect(selected === n.id ? null : n.id);
        return (
          // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>; it gets button semantics instead
          <g
            key={n.id}
            className="node pop"
            role="button"
            tabIndex={0}
            aria-label={n.label}
            opacity={dim(n.agentId)}
            onClick={(e) => {
              e.stopPropagation();
              pick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick();
              }
            }}
          >
            <circle className="halo" cx={p.x} cy={p.y} r={18} />
            {selected === n.id ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={20}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={1.5}
                strokeDasharray="2 3"
              />
            ) : null}
            <Shape
              glyph={n.glyph}
              x={p.x}
              y={p.y}
              color={colorOf(n.agentId)}
              label={n.label}
              faded={faded}
              why={n.why}
            />
            <title>{n.label}</title>
          </g>
        );
      })}
    </>
  );
}
