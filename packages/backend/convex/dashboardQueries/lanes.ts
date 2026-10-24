import type { Doc, Id } from "../_generated/dataModel";
import type { Klass } from "./shared";
import type { Source } from "./source";

// A person often leaves dead Claude Code sessions behind (restarts, resumes), so those fold into the person's
// first lane. Sessions running side by side are different agents, though, and each keeps a lane of its own,
// or a person testing alone could never watch two of their sessions meet.

const STATUS_RANK: Record<Doc<"agents">["status"], number> = { active: 2, idle: 1, offline: 0 };

type Lane = { lane: Doc<"agents">; members: Doc<"agents">[]; n: number; of: number };

/** Groups one person's agents (oldest first) into lanes: the first lane holds the dead and the earliest live. */
function personLanes(mine: Doc<"agents">[]): Lane[] {
  const [anchor, ...rest] = mine;
  if (!anchor) return [];
  const live = mine.filter((a) => a.status !== "offline");
  const own = live.filter((a) => a !== anchor && a !== live[0]);
  const folded = [anchor, ...rest.filter((a) => !own.includes(a))];
  const groups = [folded, ...own.map((a) => [a])];
  return groups.map((members, i) => ({ lane: members[0] ?? anchor, members, n: i + 1, of: groups.length }));
}

/** The lane keeps its first session's id (stable across renders) and its freshest branch and status. */
function laneRow({ lane, members }: Lane): Doc<"agents"> {
  const best = members.reduce((b, a) => (STATUS_RANK[a.status] > STATUS_RANK[b.status] ? a : b), lane);
  const fresh = members.reduce((f, a) => (a.lastSeenAt > f.lastSeenAt ? a : f), lane);
  return {
    ...lane,
    status: best.status,
    branch: fresh.branch,
    intentId: fresh.intentId,
    lastSeenAt: fresh.lastSeenAt,
  };
}

function laneMap(src: Source) {
  const people = new Map<string, Doc<"agents">[]>();
  for (const a of src.agents) people.set(a.memberId, [...(people.get(a.memberId) ?? []), a]);
  const lanes = [...people.values()].flatMap(personLanes);
  const laneOf = new Map<string, Id<"agents">>();
  const labels = new Map<Id<"agents">, string>();
  const colors = new Map<Id<"agents">, number>();
  lanes.forEach((l, i) => {
    const handle = src.handles.get(l.lane._id) ?? "agent";
    for (const a of l.members) {
      laneOf.set(a._id, l.lane._id);
      labels.set(a._id, l.of > 1 ? `${handle} · ${l.n}` : handle);
      // Lanes take colors in join order, so two of one person's sessions never look alike.
      colors.set(a._id, (i % 6) + 1);
    }
  });
  return { lanes: lanes.map(laneRow), laneOf, labels, colors };
}

export function mergeLanes(src: Source): Source {
  const { lanes, laneOf, labels, colors } = laneMap(src);
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
    labels,
    colors,
    nodes,
    nodeById: new Map(nodes.map((n) => [n._id, n])),
    tasks: src.tasks.map((t) => ({ ...t, agentId: to(t.agentId) })),
    events: src.events.map((e) => ({ ...e, agentId: to(e.agentId) })),
    inbox: src.inbox.map((i) => ({ ...i, agentId: to(i.agentId) })),
    verdicts: src.verdicts.map(verdict),
    recentVerdicts: src.recentVerdicts.map(verdict),
  };
}
