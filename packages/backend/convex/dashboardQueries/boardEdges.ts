import type { Doc, Id } from "../_generated/dataModel";
import type { BoardNode } from "./boardNodes";
import { payloadString } from "./shared";

export type EdgeKind = "duplicate" | "stale" | "conflict" | "learned" | "decides" | "adopts" | "merge";
export type BoardEdge = {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  at: number;
  /** Classification still open now. */
  open: boolean;
  /** When the catch stopped being live (resolved, or the caught agent moved on); replay uses it. */
  until?: number;
  classificationId?: Id<"classifications">;
};

type Input = {
  nodes: BoardNode[];
  verdicts: Doc<"classifications">[];
  events: Doc<"events">[];
  byId: Map<Id<"nodes">, Doc<"nodes">>;
  drawnId: (id: Id<"nodes">) => string | undefined;
  /** When each ended session was last seen: a catch on it stops being live then. */
  ended: Map<string, number>;
};

/**
 * Catches from `classifications` (newer node → the node it was judged against). A duplicate or stale catch is
 * live until the caught agent's next step (it was steered) or its session ends; a conflict is live until a human resolves it.
 */
function verdictEdges({ nodes, verdicts, events, byId, drawnId, ended }: Input): BoardEdge[] {
  const resolvedAt = new Map<string, number>();
  for (const e of events) {
    const id = e.hook === "Resolve" ? payloadString(e, "classificationId") : undefined;
    if (id) resolvedAt.set(id, e.at);
  }
  const stream = nodes.filter((n) => !n.band && n.agentId);
  const out: BoardEdge[] = [];
  const seen = new Set<string>();
  for (const c of [...verdicts].sort((a, b) => a.at - b.at)) {
    if (c.type === "normal" || !c.againstNodeId) continue;
    const from = drawnId(c.nodeId);
    const to = drawnId(c.againstNodeId);
    const key = `${from}|${to}|${c.type}`;
    if (!from || !to || from === to || seen.has(key)) continue;
    seen.add(key);
    const caught = byId.get(c.nodeId);
    const next =
      caught &&
      (stream.find((n) => n.agentId === caught.agentId && n.at > caught.at)?.at ?? ended.get(caught.agentId));
    const until =
      c.type === "conflict"
        ? c.status === "resolved"
          ? resolvedAt.get(c._id)
          : c.status === "dismissed"
            ? c.at
            : undefined
        : (next ?? (c.status === "open" ? undefined : c.at));
    out.push({
      id: c._id,
      from,
      to,
      kind: c.type,
      at: c.at,
      open: c.status === "open",
      until,
      classificationId: c._id,
    });
  }
  return out;
}

/** Lessons, decisions and verification runs tie back to the streams they came from. */
function derivedEdges({ nodes, byId, drawnId }: Input): BoardEdge[] {
  const stream = nodes.filter((n) => !n.band && n.agentId);
  const out: BoardEdge[] = [];
  const edge = (from: string, to: string, kind: EdgeKind, at: number) =>
    out.push({ id: `${kind}:${from}:${to}`, from, to, kind, at, open: false });
  for (const n of nodes) {
    if (n.glyph === "lesson") {
      const failed = stream
        .filter((s) => s.agentId === n.agentId && s.glyph === "fail" && s.at <= n.at)
        .pop();
      if (failed) edge(failed.id, n.id, "learned", n.at);
    } else if (n.glyph === "decision") {
      const raw = byId.get(n.id as Id<"nodes">);
      const parent = raw?.parentId ? drawnId(raw.parentId) : undefined;
      if (parent && parent !== n.id) edge(parent, n.id, "decides", n.at);
      const adopters = new Set<string>();
      for (const s of stream) {
        if (!n.topic || s.topic !== n.topic || s.at <= n.at || s.agentId === n.agentId) continue;
        if (s.agentId && !adopters.has(s.agentId) && s.glyph !== "intent") {
          adopters.add(s.agentId);
          edge(n.id, s.id, "adopts", s.at);
        }
      }
    } else if (n.glyph === "verify") {
      const latest = new Map<string, BoardNode>();
      for (const s of stream) if (s.agentId && s.at <= n.at) latest.set(s.agentId, s);
      for (const s of latest.values()) edge(s.id, n.id, "merge", n.at);
    }
  }
  return out;
}

export function buildEdges(input: Input): BoardEdge[] {
  return [...verdictEdges(input), ...derivedEdges(input)];
}
