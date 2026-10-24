import type { Id } from "../_generated/dataModel";
import { buildEdges } from "./boardEdges";
import { buildFeed } from "./boardFeed";
import { type BoardNode, mapNodes } from "./boardNodes";
import { type BoardSource, loadBoard } from "./boardSource";
import { verifyNodes } from "./boardVerify";
import type { Ctx } from "./shared";

function agentRows(src: BoardSource, nodes: BoardNode[]) {
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const lastEvent = new Map<string, number>();
  for (const e of src.events) lastEvent.set(e.agentId, Math.max(lastEvent.get(e.agentId) ?? 0, e.at));
  return src.agents.map((a) => ({
    id: a._id as string,
    handle: src.handles.get(a._id) ?? "unknown",
    color: src.colors.get(a._id) ?? 1,
    status: a.status,
    branch: a.branch,
    intent: a.intentId ? label.get(a.intentId) : undefined,
    lastEventAt: lastEvent.get(a._id) ?? a.lastSeenAt,
  }));
}

function openConflicts(
  src: BoardSource,
  drawnId: (id: Id<"nodes">) => string | undefined,
  nodes: BoardNode[],
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const side = (nodeId: Id<"nodes">) => {
    const id = drawnId(nodeId);
    const n = id ? byId.get(id) : undefined;
    const handle = n?.agentId ? src.handles.get(n.agentId as Id<"agents">) : undefined;
    return { nodeId, id, label: n?.label ?? "the other side", handle: handle ?? "agent" };
  };
  return src.verdicts
    .filter((c) => c.type === "conflict" && c.status === "open" && c.againstNodeId)
    .slice(0, 10)
    .flatMap((c) =>
      c.againstNodeId
        ? [
            {
              classificationId: c._id,
              reason: c.reason.replace(/^\[little-brother\]\s*/, ""),
              comparison: c.comparison,
              a: side(c.againstNodeId),
              b: side(c.nodeId),
            },
          ]
        : [],
    );
}

/** Everything the one-screen dashboard needs; the client only lays it out. */
export async function board(ctx: Ctx) {
  const src = await loadBoard(ctx);
  const mapped = mapNodes(src);
  const nodes = [...mapped.nodes, ...verifyNodes(src.events)].sort((a, b) => a.at - b.at);
  const edges = buildEdges({
    nodes,
    verdicts: src.verdicts,
    events: src.events,
    byId: mapped.byId,
    drawnId: mapped.drawnId,
    ended: new Map(src.agents.filter((a) => a.status === "offline").map((a) => [a._id, a.lastSeenAt])),
  });
  const live = src.recentVerdicts.filter((c) => c.type !== "normal");
  return {
    repo: src.agents[0]?.repo ?? "",
    agents: agentRows(src, nodes),
    nodes,
    edges,
    feed: buildFeed(nodes, edges),
    conflicts: openConflicts(src, mapped.drawnId, nodes),
    counts: {
      // Git-found misses never fired live, so they are not catches; they are what recall is measured against.
      caught: live.filter((c) => c.status !== "dismissed" && c.gitStatus !== "missed").length,
      missed: live.filter((c) => c.gitStatus === "missed").length,
    },
  };
}
