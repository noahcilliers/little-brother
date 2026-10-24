import type { Edge, Node } from "@xyflow/react";
import type { GraphData, GraphEdge, GraphLane, GraphNode } from "@/lib/api";
import type { VerdictType } from "@/lib/format";
import { gitLabel } from "@/lib/git";

export const LANE_W = 260;
const TOP = 78;
const ROW = 66;

export type FlagState = { type: Exclude<VerdictType, "normal">; open: boolean } | undefined;
export type LbNodeData = { node: GraphNode; flag: FlagState; selected: boolean };
export type LaneData = { lane: GraphLane; height: number };
export type LbFlowNode = Node<LbNodeData, "lb">;
export type LaneFlowNode = Node<LaneData, "lane">;

const RANK = { conflict: 3, duplicate: 2, stale: 1 } as const;

function flagFor(id: string, edges: GraphEdge[]): FlagState {
  let best: FlagState;
  for (const e of edges) {
    if (e.status === "dismissed" || e.type === "normal" || (e.source !== id && e.target !== id)) continue;
    const open = e.status === "open";
    if (!best || RANK[e.type] > RANK[best.type] || (RANK[e.type] === RANK[best.type] && open))
      best = { type: e.type, open };
  }
  return best;
}

function edgeLabel(e: GraphEdge): string | undefined {
  // Settled verdicts stay as faint lines unless git later contradicted the live call; labels never pile up.
  if (e.status !== "open" && e.gitStatus !== "missed") return undefined;
  const head = e.takeover ? "takeover" : e.relation.replace(/_/g, " ");
  return e.gitStatus ? `${head} · ${gitLabel(e.gitStatus)}` : head;
}

// A git-found miss is the one label drawn inverted, with a dashed line, so it reads apart from live verdicts.
const MISSED: Pick<Edge, "style" | "labelStyle" | "labelBgStyle" | "className"> = {
  style: { stroke: "var(--fg)", strokeWidth: 2, strokeDasharray: "1 4" },
  labelStyle: { fill: "var(--bg)" },
  labelBgStyle: { fill: "var(--fg)", stroke: "var(--fg)", strokeDasharray: "2 2" },
  className: "missed",
};

function edgeStyle(e: GraphEdge): Pick<Edge, "style" | "className" | "labelStyle" | "labelBgStyle"> {
  if (e.gitStatus === "missed") return MISSED;
  if (e.status !== "open") return { style: { stroke: "var(--faint)", strokeWidth: 1 }, className: "quiet" };
  if (e.type === "duplicate")
    return { style: { stroke: "var(--fg)", strokeWidth: 1.5, strokeDasharray: "2 3" } };
  if (e.type === "stale")
    return { style: { stroke: "var(--fg)", strokeWidth: 1.25, strokeDasharray: "6 4" } };
  return { style: { stroke: "var(--fg)", strokeWidth: 2.5 } };
}

/** One lane per agent, left to right; each lane reads top to bottom in time. */
export function layoutGraph(
  data: GraphData,
  selectedId: string | null,
): { nodes: (LbFlowNode | LaneFlowNode)[]; edges: Edge[]; width: number; height: number } {
  const laneIndex = new Map(data.lanes.map((l, i) => [l._id as string, i]));
  const laneY = new Map<string, number>();
  const pos = new Map<string, { x: number; y: number; lane: number }>();
  let maxY = TOP;
  const flowNodes: LbFlowNode[] = [];
  for (const n of data.nodes) {
    const lane = laneIndex.get(n.agentId);
    if (lane === undefined) continue;
    const y = laneY.get(n.agentId) ?? TOP;
    laneY.set(n.agentId, y + ROW);
    maxY = Math.max(maxY, y);
    const p = { x: lane * LANE_W + 12, y, lane };
    pos.set(n._id, p);
    flowNodes.push({
      id: n._id,
      type: "lb",
      position: { x: p.x, y: p.y },
      data: { node: n, flag: flagFor(n._id, data.edges), selected: n._id === selectedId },
      draggable: false,
    });
  }
  const height = maxY + ROW + 40;
  const lanes: LaneFlowNode[] = data.lanes.map((lane, i) => ({
    id: `lane:${lane._id}`,
    type: "lane",
    position: { x: i * LANE_W, y: 0 },
    data: { lane, height },
    draggable: false,
    selectable: false,
    zIndex: -1,
  }));
  const edges: Edge[] = data.edges.flatMap((e) => {
    const s = pos.get(e.source);
    const t = pos.get(e.target);
    if (!s || !t) return [];
    const rightward = s.lane <= t.lane;
    return [
      {
        id: e._id,
        source: e.source,
        target: e.target,
        sourceHandle: rightward ? "r" : "ls",
        targetHandle: s.lane === t.lane ? "rt" : rightward ? "l" : "rt",
        label: edgeLabel(e),
        labelBgPadding: [4, 2] as [number, number],
        ...edgeStyle(e),
      },
    ];
  });
  return { nodes: [...lanes, ...flowNodes], edges, width: data.lanes.length * LANE_W, height };
}
