import type { Doc, Id } from "../_generated/dataModel";
import { blockVerdicts, eventFacts, filesOf } from "./boardFacts";
import type { BoardSource } from "./boardSource";
import { abandonedActions, drawnParents, intentResolver } from "./boardTrajectory";
import {
  actionLabel,
  actionNote,
  decisionLabel,
  failureLine,
  intentLabel,
  intentNote,
  knowledgeNote,
  lessonLabel,
  verdictNote,
} from "./labels";

export type Glyph =
  | "intent"
  | "edit"
  | "ok"
  | "fail"
  | "blocked"
  | "superseded"
  | "lesson"
  | "decision"
  | "verify";
export type Why = "duplicate" | "stale" | "conflict";
export type FileRef = { path: string; op: string };
export type BoardNode = {
  id: string;
  agentId: string | null;
  glyph: Glyph;
  band?: "lesson" | "decision";
  parent?: string;
  abandoned: boolean;
  label: string;
  note: string;
  topic?: string;
  files: FileRef[];
  at: number;
  why?: Why;
};

type N = Doc<"nodes">;

function glyphOf(n: N, denied: boolean): Glyph {
  if (n.verb === "DECIDE") return "decision";
  if (n.kind === "knowledge") return "lesson";
  if (n.kind === "intent") return "intent";
  if (n.outcome === "failed") return "fail";
  if (n.outcome === "superseded") return denied ? "blocked" : "superseded";
  return n.verb === "TEST" && n.outcome === "succeeded" ? "ok" : "edit";
}

function labelFor(n: N, glyph: Glyph): string {
  if (glyph === "intent") return intentLabel(n);
  if (glyph === "decision") return decisionLabel(n);
  if (glyph === "lesson") return lessonLabel(n);
  return actionLabel(n);
}

type NoteFacts = { tail?: string; rationale?: string; reason?: string };
function noteFor(n: N, glyph: Glyph, f: NoteFacts): string {
  switch (glyph) {
    case "intent":
      return intentNote(n);
    case "fail":
      return (f.tail && failureLine(f.tail)) || actionNote(n);
    case "blocked":
      return f.reason ? verdictNote(f.reason) : "Stopped by a hook before it ran.";
    case "superseded":
      return `Superseded by an owner decision. ${actionNote(n)}`;
    case "lesson":
      return knowledgeNote(n);
    case "decision":
      return [knowledgeNote(n), f.rationale].filter(Boolean).join(". ");
    default:
      return actionNote(n);
  }
}

/** Maps stored nodes to glyphs; EXPLORE reads are not drawn but list their files under the intent. */
export function mapNodes(src: BoardSource) {
  const facts = eventFacts(src.events);
  const byId = new Map(src.nodes.map((n) => [n._id, n]));
  const intentOf = intentResolver(byId);
  const groupOf = (n: N) => intentOf(n) ?? `agent:${n.agentId}`;
  const lanes = new Set<string>(src.agents.map((a) => a._id));
  const blocks = blockVerdicts(src.verdicts);
  const banded = (n: N) => n.verb === "DECIDE" || n.kind === "knowledge";
  const inStream = (n: N) => lanes.has(n.agentId) && n.verb !== "EXPLORE" && !banded(n);
  const stream = src.nodes.filter(inStream);
  const abandoned = abandonedActions(
    stream.filter((n) => n.kind === "action" && !facts.denied.has(n._id)),
    groupOf,
  );

  const intentFiles = new Map<string, Map<string, string>>();
  for (const n of src.nodes) {
    const g = n.kind === "action" ? intentOf(n) : undefined;
    if (!g) continue;
    const files = intentFiles.get(g) ?? new Map<string, string>();
    for (const f of filesOf(n)) {
      const op = n.verb === "EXPLORE" ? "read" : f.op;
      if (!files.has(f.path) || files.get(f.path) === "read") files.set(f.path, op);
    }
    intentFiles.set(g, files);
  }

  const parents = drawnParents(
    stream.map((n) => ({
      id: n._id,
      agentId: n.agentId,
      group: n.kind === "intent" ? n._id : groupOf(n),
      isIntent: n.kind === "intent",
      blocked: facts.denied.has(n._id),
      abandoned: abandoned.has(n._id),
    })),
  );

  const nodes: BoardNode[] = [];
  for (const n of src.nodes) {
    if (!inStream(n) && !banded(n)) continue;
    const glyph = glyphOf(n, facts.denied.has(n._id));
    const verdict = glyph === "blocked" ? blocks.get(n._id) : undefined;
    const label = labelFor(n, glyph);
    const note = noteFor(n, glyph, {
      tail: facts.failTail.get(n._id),
      rationale: facts.rationale.get(n._id),
      reason: verdict?.reason,
    });
    const files = glyph === "intent" ? [...(intentFiles.get(n._id) ?? [])] : undefined;
    nodes.push({
      id: n._id,
      agentId: n.agentId,
      glyph,
      band: glyph === "lesson" ? "lesson" : glyph === "decision" ? "decision" : undefined,
      parent: parents.get(n._id),
      abandoned: abandoned.has(n._id),
      label,
      note,
      topic: n.topic,
      files: files ? files.map(([path, op]) => ({ path, op })) : filesOf(n),
      at: n.at,
      why: verdict && verdict.type !== "normal" ? verdict.type : undefined,
    });
  }
  // Verdicts may name an EXPLORE read; on the board that read lives inside its intent.
  const drawn = new Set(nodes.map((n) => n.id));
  const drawnId = (id: Id<"nodes">): string | undefined => {
    if (drawn.has(id)) return id;
    const n = byId.get(id);
    const g = n ? intentOf(n) : undefined;
    return g && drawn.has(g) ? g : undefined;
  };
  return { nodes, drawnId, byId };
}
