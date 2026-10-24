import type { Board, BoardEdge, BoardNode } from "./api";
import type { Point } from "./board-layout";

/** A catch pulses while it is live at time t: open now, or (in replay) before it was resolved or steered. */
export function edgeLive(e: BoardEdge, t: number): boolean {
  if (e.at > t) return false;
  return e.until !== undefined ? t < e.until : e.open;
}

export function curve(a: Point, b: Point): string {
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function arc(a: Point, b: Point, lift: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + lift;
  return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
}

/** The latest drawn step of each agent at time t; it carries the soft pulsing ring. */
export function heads(nodes: BoardNode[]): Map<string, BoardNode> {
  const out = new Map<string, BoardNode>();
  for (const n of nodes) if (n.agentId && !n.band && n.glyph !== "intent") out.set(n.agentId, n);
  return out;
}

const WORDS: Record<BoardEdge["kind"], [string, string]> = {
  duplicate: ["duplicate of", "duplicated by"],
  stale: ["warned by", "warned"],
  conflict: ["conflicts with", "conflicts with"],
  learned: ["lesson", "lesson from"],
  decides: ["decided", "decided from"],
  adopts: ["adopted by", "adopts"],
  merge: ["merged", "merged"],
};

export function relations(board: Board, id: string, t: number) {
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  return board.edges.flatMap((e) => {
    if (e.at > t || (e.from !== id && e.to !== id)) return [];
    const outgoing = e.from === id;
    const other = byId.get(outgoing ? e.to : e.from);
    if (!other) return [];
    const word = WORDS[e.kind][outgoing ? 0 : 1];
    return [{ key: `${e.id}:${outgoing}`, kind: e.kind, word, other, live: edgeLive(e, t) }];
  });
}
