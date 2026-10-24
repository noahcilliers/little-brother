"use client";

import { Handle, type NodeProps, Position, useViewport } from "@xyflow/react";
import { clsx } from "clsx";
import type { GraphLane } from "@/lib/api";
import { signatureLines } from "@/lib/format";
import { settledInGit } from "@/lib/git";
import { BranchStrip } from "../ui/branch-strip";
import { LANE_W, type LaneFlowNode, type LbFlowNode } from "./layout";

function tagFor(data: LbFlowNode["data"]): string {
  if (data.node.verb === "DECIDE") return "decided";
  if (data.node.outcome === "superseded") return "superseded";
  if (!data.flag) return "";
  return data.flag.open ? data.flag.type : `${data.flag.type} · resolved`;
}

export function LbNode({ data }: NodeProps<LbFlowNode>) {
  const { node, flag } = data;
  const lines = signatureLines(node);
  const tag = tagFor(data);
  const settled = settledInGit(node.landed);
  return (
    <div
      className={clsx(
        "gnode",
        node.kind,
        flag?.type,
        flag?.open && !settled && "open",
        settled && "landed",
        node.outcome === "superseded" && "superseded",
        data.selected && "selected",
      )}
      title={node.text}
    >
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Left} id="ls" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="target" position={Position.Right} id="rt" />
      <div className="l1">
        <b>{node.verb}</b>
        {lines.head}
      </div>
      <div className="l2">{lines.target || node.kind}</div>
      {tag ? <span className="tag">{tag}</span> : null}
      {node.landed ? (
        <span className="land" title={node.baseRev ? `base ${node.baseRev.slice(0, 7)}` : undefined}>
          {node.landed}
        </span>
      ) : null}
    </div>
  );
}

export function LaneNode({ data }: NodeProps<LaneFlowNode>) {
  return <div className="lane" style={{ height: data.height }} />;
}

/** Lane headers pinned to the top of the canvas so they stay readable while scrolling through history. */
export function LaneHeaders({ lanes }: { lanes: GraphLane[] }) {
  const { x, zoom } = useViewport();
  return (
    <div className="lane-heads">
      {lanes.map((lane, i) => (
        <div key={lane._id} className="lane-head" style={{ left: x + i * LANE_W * zoom }}>
          <b>
            {lane.handle} <span className={clsx("status", lane.status)}>{lane.status}</span>
          </b>
          <BranchStrip a={lane} className="lane-strip" />
        </div>
      ))}
    </div>
  );
}
