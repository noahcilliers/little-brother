import type { BoardEdge, BoardNode } from "@/lib/api";
import type { Layout } from "@/lib/board-layout";
import { arc, curve, edgeLive } from "@/lib/board-view";

type Props = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  layout: Layout;
  t: number;
  colorOf: (agentId: string | null) => string;
  dim: (agentId: string | null) => number;
};

/** Parent → child steps of each stream; new steps draw in along their path. */
export function TrajectoryEdges({ nodes, layout, t, colorOf, dim }: Omit<Props, "edges">) {
  const visible = new Set(nodes.map((n) => n.id));
  return (
    <>
      {nodes.map((n) => {
        if (!n.parent || !visible.has(n.parent)) return null;
        const a = layout.pos.get(n.parent);
        const b = layout.pos.get(n.id);
        if (!a || !b) return null;
        const faded = n.abandoned && t >= (layout.abandonAt.get(n.id) ?? Number.POSITIVE_INFINITY);
        const blocked = n.glyph === "blocked";
        const dash = faded ? "5 5" : blocked ? "2 4" : undefined;
        return (
          <path
            key={`p:${n.id}`}
            className={dash ? "fade-in" : "draw"}
            d={curve(a, b)}
            fill="none"
            stroke={faded ? "var(--faint)" : colorOf(n.agentId)}
            strokeWidth={blocked ? 2 : 3}
            strokeLinecap="round"
            strokeDasharray={dash}
            pathLength={dash ? undefined : 1}
            opacity={dim(n.agentId)}
          />
        );
      })}
    </>
  );
}

/** Catches and the links lessons, decisions and verification runs make across streams. */
export function CrossEdges({ nodes, edges, layout, t, colorOf, dim }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <>
      {edges.map((e) => {
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        const a = layout.pos.get(e.from);
        const b = layout.pos.get(e.to);
        if (e.at > t || !from || !to || !a || !b) return null;
        const live = edgeLive(e, t);
        const opacity = Math.max(dim(from.agentId), dim(to.agentId));
        const common = { fill: "none", opacity, className: "fade-in" };
        switch (e.kind) {
          case "conflict":
            return (
              <path
                key={e.id}
                {...common}
                className={live ? "march" : "fade-in"}
                d={arc(a, b, -40)}
                stroke={live ? "var(--hot)" : "var(--faint)"}
                strokeWidth={live ? 2.5 : 1.4}
                strokeDasharray="7 5"
              />
            );
          case "duplicate":
          case "stale":
            return (
              <path
                key={e.id}
                {...common}
                d={curve(a, b)}
                stroke={live ? "var(--warn)" : "var(--faint)"}
                strokeWidth={live ? 2.2 : 1.2}
                strokeDasharray="3 4"
              />
            );
          case "learned":
            return <path key={e.id} {...common} d={curve(a, b)} stroke="var(--faint)" strokeWidth={1.4} />;
          case "decides":
          case "adopts":
            return (
              <path
                key={e.id}
                {...common}
                d={curve(a, b)}
                stroke={colorOf(e.kind === "decides" ? to.agentId : from.agentId)}
                strokeWidth={1.8}
                strokeDasharray={e.kind === "adopts" ? "2 4" : undefined}
              />
            );
          case "merge":
            return <path key={e.id} {...common} d={curve(a, b)} stroke="var(--line)" strokeWidth={1.6} />;
        }
        return null;
      })}
    </>
  );
}
