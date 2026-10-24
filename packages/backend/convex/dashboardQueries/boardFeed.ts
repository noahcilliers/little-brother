import type { BoardEdge } from "./boardEdges";
import type { BoardNode, Glyph, Why } from "./boardNodes";

export type Tone = "hot" | "warn" | "faint";
export type FeedRow = {
  id: string;
  nodeId: string;
  at: number;
  glyph: Glyph;
  label: string;
  tag?: Why;
  /** One-line summary for the top bar when this is the latest notable thing. */
  caption?: string;
  tone: Tone;
};

const FEED_LIMIT = 60;

function nodeCaption(n: BoardNode): [string, Tone] | undefined {
  switch (n.glyph) {
    case "fail":
      return [`${n.label} failed`, "hot"];
    case "blocked":
      if (n.why === "duplicate") return ["Duplicate stopped", "warn"];
      if (n.why === "stale") return ["Steered off a failed path", "warn"];
      if (n.why === "conflict") return ["Held by an open conflict", "hot"];
      return ["Edit blocked", "warn"];
    case "lesson":
      return ["Failure became a lesson", "faint"];
    case "decision":
      return [`Decided: ${n.topic ?? n.label}`, "faint"];
    case "verify":
      return [n.label, n.label === "Merged clean" ? "faint" : "hot"];
    default:
      return undefined;
  }
}

function edgeCaption(e: BoardEdge, from: BoardNode, to: BoardNode | undefined): [string, Tone] | undefined {
  if (e.kind === "conflict") return [`Conflict: ${from.topic ?? to?.topic ?? from.label}`, "hot"];
  if (e.kind === "duplicate") return ["Duplicate flagged", "warn"];
  if (e.kind === "stale") return ["Steered off a failed path", "warn"];
  return undefined;
}

/** Notable things, newest first: every drawn step except intents, plus catches that did not block a step. */
export function buildFeed(nodes: BoardNode[], edges: BoardEdge[]): FeedRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rows: FeedRow[] = [];
  for (const n of nodes) {
    if (n.glyph === "intent") continue;
    const cap = nodeCaption(n);
    rows.push({
      id: n.id,
      nodeId: n.id,
      at: n.at,
      glyph: n.glyph,
      label: n.label,
      tag: n.why,
      caption: cap?.[0],
      tone: cap?.[1] ?? "faint",
    });
  }
  for (const e of edges) {
    const from = byId.get(e.from);
    if (!from || !e.classificationId) continue;
    // A blocked step already carries its catch as a tag.
    if (from.glyph === "blocked" && from.why === e.kind) continue;
    if (e.kind !== "duplicate" && e.kind !== "stale" && e.kind !== "conflict") continue;
    const cap = edgeCaption(e, from, byId.get(e.to));
    rows.push({
      id: e.id,
      nodeId: from.id,
      at: e.at,
      glyph: from.glyph,
      label: from.label,
      tag: e.kind,
      caption: cap?.[0],
      tone: cap?.[1] ?? "faint",
    });
  }
  return rows.sort((a, b) => b.at - a.at).slice(0, FEED_LIMIT);
}
