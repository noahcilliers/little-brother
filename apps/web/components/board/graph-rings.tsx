import type { BoardEdge, BoardNode } from "@/lib/api";
import type { Layout, Point } from "@/lib/board-layout";
import { edgeLive } from "@/lib/board-view";

type Props = {
  edges: BoardEdge[];
  heads: BoardNode[];
  visible: Set<string>;
  layout: Layout;
  t: number;
  colorOf: (agentId: string | null) => string;
};

function Ring({ p, color, r, slow }: { p: Point; color: string; r: number; slow?: boolean }) {
  return (
    <circle
      className={slow ? "ring slow" : "ring"}
      cx={p.x}
      cy={p.y}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={slow ? 1.5 : 2}
    />
  );
}

/** Pulses: both ends of a live conflict, the target of a live duplicate or stale catch, each agent's head. */
export function Rings({ edges, heads, visible, layout, t, colorOf }: Props) {
  const rings: { key: string; p: Point; color: string; r: number; slow?: boolean }[] = [];
  for (const e of edges) {
    if (!edgeLive(e, t) || !visible.has(e.from) || !visible.has(e.to)) continue;
    const a = layout.pos.get(e.from);
    const b = layout.pos.get(e.to);
    if (!a || !b) continue;
    if (e.kind === "conflict") {
      rings.push({ key: `${e.id}:a`, p: a, color: "var(--hot)", r: 12 });
      rings.push({ key: `${e.id}:b`, p: b, color: "var(--hot)", r: 12 });
    } else if (e.kind === "duplicate" || e.kind === "stale") {
      rings.push({ key: `${e.id}:b`, p: b, color: "var(--warn)", r: 14 });
    }
  }
  for (const n of heads) {
    const p = layout.pos.get(n.id);
    if (p) rings.push({ key: `head:${n.id}`, p, color: colorOf(n.agentId), r: 11, slow: true });
  }
  return (
    <g pointerEvents="none">
      {rings.map((r) => (
        <Ring key={r.key} p={r.p} color={r.color} r={r.r} slow={r.slow} />
      ))}
    </g>
  );
}
