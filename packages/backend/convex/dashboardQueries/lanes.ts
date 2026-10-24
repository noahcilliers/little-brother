import type { Doc, Id } from "../_generated/dataModel";
import type { Klass } from "./shared";
import type { Source } from "./source";

// A person often runs several Claude Code sessions (new windows, restarts, resumes). The timeline shows
// people, so it folds them into one lane per member. The session panes show what each terminal is doing,
// so there only dead sessions fold away and every live one keeps a pane of its own.

const STATUS_RANK: Record<Doc<"agents">["status"], number> = { active: 2, idle: 1, offline: 0 };

/** Agents that share a lane; the first one's id names the lane, so it stays stable across renders. */
type Group = Doc<"agents">[];

function byPerson(agents: Doc<"agents">[]): Group[] {
  const people = new Map<string, Group>();
  for (const a of agents) people.set(a.memberId, [...(people.get(a.memberId) ?? []), a]);
  return [...people.values()];
}

/** One person's agents, oldest first: the first group holds the dead ones and the earliest live one. */
function liveGroups(mine: Group): Group[] {
  const anchor = mine[0];
  if (!anchor) return [];
  const live = mine.filter((a) => a.status !== "offline");
  const own = live.filter((a) => a !== anchor && a !== live[0]);
  return [mine.filter((a) => !own.includes(a)), ...own.map((a) => [a])];
}

/** The lane keeps its anchor's id and its freshest branch and best status. */
function laneRow(group: Group, anchor: Doc<"agents">): Doc<"agents"> {
  const best = group.reduce((b, a) => (STATUS_RANK[a.status] > STATUS_RANK[b.status] ? a : b), anchor);
  const fresh = group.reduce((f, a) => (a.lastSeenAt > f.lastSeenAt ? a : f), anchor);
  return {
    ...anchor,
    status: best.status,
    branch: fresh.branch,
    intentId: fresh.intentId,
    lastSeenAt: fresh.lastSeenAt,
  };
}

/** Rewrites every agent reference in the source to its group's lane. */
function fold(src: Source, groups: Group[]): Source {
  const laneOf = new Map<string, Id<"agents">>();
  const lanes: Doc<"agents">[] = [];
  for (const g of groups) {
    const anchor = g[0];
    if (!anchor) continue;
    for (const a of g) laneOf.set(a._id, anchor._id);
    lanes.push(laneRow(g, anchor));
  }
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

/** One lane per person, for the timeline. */
export function mergeLanes(src: Source): Source {
  return fold(src, byPerson(src.agents));
}

/**
 * One lane per live Claude session, for the session panes. `labels` names each lane by its person, plus
 * "· n" when that person has several live sessions.
 */
export function splitSessions(src: Source): { src: Source; labels: Map<Id<"agents">, string> } {
  const labels = new Map<Id<"agents">, string>();
  const groups = byPerson(src.agents).flatMap((mine) => {
    const split = liveGroups(mine);
    split.forEach((g, i) => {
      const anchor = g[0];
      if (!anchor) return;
      const handle = src.handles.get(anchor._id) ?? "agent";
      labels.set(anchor._id, split.length > 1 ? `${handle} · ${i + 1}` : handle);
    });
    return split;
  });
  return { src: fold(src, groups), labels };
}
