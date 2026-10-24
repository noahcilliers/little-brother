"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Empty, Loading } from "../ui/empty";
import { layoutGraph } from "./layout";
import { LaneHeaders, LaneNode, LbNode } from "./lb-node";
import { NodePanel } from "./node-panel";

const nodeTypes: NodeTypes = { lb: LbNode, lane: LaneNode };

export function GraphView() {
  const data = useQuery(api.dashboard.graph);
  const [selected, setSelected] = useState<string | null>(null);
  const flow = useMemo(() => (data ? layoutGraph(data, selected) : null), [data, selected]);
  const laneKey = data?.lanes.map((l) => l._id).join(",") ?? "";
  const wrap = useRef<HTMLDivElement>(null);

  // Fit lanes to the width at a readable zoom instead of shrinking the whole history to fit; lanes start at the top.
  const initialViewport = () => {
    const box = wrap.current?.getBoundingClientRect();
    if (!flow || !box) return { x: 0, y: 0, zoom: 1 };
    const zoom = Math.max(0.6, Math.min(1, (box.width - 48) / Math.max(flow.width, 1)));
    const x = Math.max(24, (box.width - flow.width * zoom) / 2);
    return { x, y: 0, zoom };
  };

  return (
    <div className="graph-wrap" ref={wrap}>
      {!data || !flow ? (
        <Loading what="graph" />
      ) : data.lanes.length === 0 ? (
        <Empty
          title="no agents connected"
          sample={
            "PLAN     auth.mech   switch sessions to JWT\nEDIT     db.users    db/schema/users.ts\nLEARN    api.cors    cors(origin:*, creds) → FAIL"
          }
        >
          Each Claude Code session becomes a lane here as soon as it runs <code>lb join</code> and fires its
          first hook. Nodes appear in compact signature form; verdict edges connect lanes.
        </Empty>
      ) : (
        <ReactFlowProvider>
          <ReactFlow
            key={laneKey}
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => {
              if (n.type === "lb") setSelected(n.id);
            }}
            onPaneClick={() => setSelected(null)}
            nodesConnectable={false}
            nodesDraggable={false}
            onInit={(rf) => void rf.setViewport(initialViewport())}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls showInteractive={false} position="bottom-left" />
            <LaneHeaders lanes={data.lanes} />
          </ReactFlow>
        </ReactFlowProvider>
      )}
      {selected ? <NodePanel nodeId={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
