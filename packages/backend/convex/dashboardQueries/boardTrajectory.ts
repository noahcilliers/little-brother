import type { Doc, Id } from "../_generated/dataModel";

type N = Doc<"nodes">;

/** The intent a node belongs to: follow parents up until an intent (actions may chain off earlier actions). */
export function intentResolver(byId: Map<Id<"nodes">, N>) {
  return (n: N): Id<"nodes"> | undefined => {
    let cur: N | undefined = n;
    for (let hops = 0; cur && hops < 8; hops++) {
      if (cur.kind === "intent") return cur._id;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return undefined;
  };
}

/**
 * Abandoned work is drawn as the dashed grey branch above a stream. The heuristic is deliberately simple:
 * within one intent, a failed action is abandoned, and so is every earlier action on a file the agent then
 * FIXed or REVERTed after that failure, i.e. the attempt it backed out of.
 */
export function abandonedActions(actions: N[], groupOf: (n: N) => string): Set<Id<"nodes">> {
  const groups = new Map<string, N[]>();
  for (const n of actions) {
    const key = groupOf(n);
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const out = new Set<Id<"nodes">>();
  for (const list of groups.values()) {
    for (const f of list) {
      if (f.outcome !== "failed") continue;
      out.add(f._id);
      const repaired = new Set(
        list.filter((r) => r.at > f.at && (r.verb === "FIX" || r.verb === "REVERT")).flatMap((r) => r.files),
      );
      for (const n of list) {
        if (n.at < f.at && n.files.some((p) => repaired.has(p))) out.add(n._id);
      }
    }
  }
  return out;
}

export type StreamItem = {
  id: string;
  agentId: string;
  group: string;
  isIntent: boolean;
  blocked: boolean;
  abandoned: boolean;
};

/**
 * The edge drawn into each stream node. Stored parents point every action at its intent, which would draw a
 * fan; the board instead chains a trajectory step to step. Abandoned steps chain among themselves off the main
 * line, blocked steps hang off the main line, and a new intent continues from the agent's last main step.
 */
export function drawnParents(items: StreamItem[]): Map<string, string> {
  const out = new Map<string, string>();
  const lastMain = new Map<string, string>();
  const groupMain = new Map<string, string>();
  const groupAny = new Map<string, string>();
  const set = (id: string, parent: string | undefined) => {
    if (parent) out.set(id, parent);
  };
  for (const n of items) {
    const agentMain = lastMain.get(n.agentId);
    if (n.isIntent) {
      set(n.id, agentMain);
      lastMain.set(n.agentId, n.id);
      groupMain.set(n.id, n.id);
      groupAny.set(n.id, n.id);
    } else if (n.abandoned) {
      set(n.id, groupAny.get(n.group) ?? groupMain.get(n.group) ?? agentMain);
      groupAny.set(n.group, n.id);
    } else if (n.blocked) {
      set(n.id, groupMain.get(n.group) ?? agentMain);
    } else {
      set(n.id, groupMain.get(n.group) ?? agentMain);
      groupMain.set(n.group, n.id);
      groupAny.set(n.group, n.id);
      lastMain.set(n.agentId, n.id);
    }
  }
  return out;
}
