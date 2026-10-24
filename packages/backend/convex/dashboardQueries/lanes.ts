import type { Doc, Id } from "../_generated/dataModel";
import type { Klass } from "./shared";
import type { Source } from "./source";

// A person often runs several Claude Code sessions (new windows, restarts, resumes). The board shows people,
// so every agent reference is rewritten to one lane per member before anything is built from the source.

const STATUS_RANK: Record<Doc<"agents">["status"], number> = { active: 2, idle: 1, offline: 0 };

function laneMap(agents: Doc<"agents">[]): {
  lanes: Doc<"agents">[];
  laneOf: Map<string, Id<"agents">>;
} {
  const first = new Map<string, Doc<"agents">>();
  const latest = new Map<string, Doc<"agents">>();
  for (const a of agents) {
    if (!first.has(a.memberId)) first.set(a.memberId, a);
    const cur = latest.get(a.memberId);
    if (!cur || a.lastSeenAt > cur.lastSeenAt) latest.set(a.memberId, a);
  }
  const laneOf = new Map<string, Id<"agents">>();
  for (const a of agents) {
    const lane = first.get(a.memberId);
    if (lane) laneOf.set(a._id, lane._id);
  }
  // The lane keeps the first session's id (stable across renders) and the freshest branch and status.
  const lanes = [...first.values()].map((lane) => {
    const mine = agents.filter((a) => a.memberId === lane.memberId);
    const best = mine.reduce((b, a) => (STATUS_RANK[a.status] > STATUS_RANK[b.status] ? a : b), lane);
    const fresh = latest.get(lane.memberId) ?? lane;
    return {
      ...lane,
      status: best.status,
      branch: fresh.branch,
      intentId: fresh.intentId,
      lastSeenAt: fresh.lastSeenAt,
    };
  });
  return { lanes, laneOf };
}

export function mergeLanes(src: Source): Source {
  const { lanes, laneOf } = laneMap(src.agents);
  const to = <T extends Id<"agents"> | undefined>(id: T): T => (id ? (laneOf.get(id) ?? id) : id) as T;
  const verdict = (c: Klass): Klass => ({
    ...c,
    agentIds: c.agentIds.map((id) => to(id)),
    winnerAgentId: to(c.winnerAgentId),
  });
  const nodes = src.nodes.map((n) => ({ ...n, agentId: to(n.agentId) }));
  return {
    ...src,
    agents: lanes,
    nodes,
    nodeById: new Map(nodes.map((n) => [n._id, n])),
    tasks: src.tasks.map((t) => ({ ...t, agentId: to(t.agentId) })),
    events: src.events.map((e) => ({ ...e, agentId: to(e.agentId) })),
    inbox: src.inbox.map((i) => ({ ...i, agentId: to(i.agentId) })),
    verdicts: src.verdicts.map(verdict),
    recentVerdicts: src.recentVerdicts.map(verdict),
  };
}
