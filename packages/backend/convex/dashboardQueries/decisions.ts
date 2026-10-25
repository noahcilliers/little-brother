import { needsPerson } from "@lb/core";
import type { Id } from "../_generated/dataModel";
import { clip, lbSentence, planGist, subjectThing } from "./labels";
import type { Source } from "./source";
import type { BoardTask } from "./tasks";

export type DecisionSide = {
  nodeId: Id<"nodes">;
  agentId: string;
  handle: string;
  taskId?: string;
  subject: string;
  /** What "Keep …" names: the task subject without its leading verb. */
  keep: string;
  file?: string;
  /** The ≤40-line hunk or content the connector stored for this change. */
  preview?: string;
  at: number;
};
export type BoardDecision = {
  id: string;
  /** What kind of wait: a conflict or a duplicate can keep one side; a stale path or an ordering wait can only be let through. */
  kind: "conflict" | "duplicate" | "stale" | "ordering";
  classificationId: Id<"classifications">;
  topic: string;
  owner?: string;
  t: number;
  /** How long after the change that triggered it the conflict was found. */
  detectedAfterMs: number;
  rationale: string;
  comparison?: string;
  sides: DecisionSide[];
};

const DECISION_LIMIT = 10;

/**
 * Catches a person has to settle: open, enforcing (block or serialize), and with no claim already given to one
 * side by the priority policy (that is a takeover, which needs nobody). Settling them here, not in a terminal,
 * keeps one place where the team sees and makes the call.
 */
export function buildDecisions(
  src: Source,
  tasks: BoardTask[],
  taskOfNode: Map<string, string>,
): BoardDecision[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const handles = new Map<string, string>(src.handles);
  const side = (nodeId: Id<"nodes">): DecisionSide | undefined => {
    const n = src.nodeById.get(nodeId);
    if (!n) return undefined;
    const taskId = taskOfNode.get(nodeId);
    const subject =
      (taskId && taskById.get(taskId)?.subject) ||
      n.label ||
      (n.kind === "intent" ? planGist(n.text) : "") ||
      n.files[0] ||
      n.verb.toLowerCase();
    return {
      nodeId,
      agentId: n.agentId,
      handle: handles.get(n.agentId) ?? "agent",
      taskId,
      subject,
      keep: subjectThing(subject),
      file: n.files[0],
      preview: n.preview,
      at: n.at,
    };
  };
  const out: BoardDecision[] = [];
  for (const c of src.verdicts) {
    if (c.type === "normal" || !needsPerson(c) || !c.againstNodeId) continue;
    const a = side(c.againstNodeId);
    const b = side(c.nodeId);
    if (!a || !b) continue;
    const topic =
      src.nodeById.get(c.nodeId)?.topic ??
      src.nodeById.get(c.againstNodeId)?.topic ??
      (src.nodeById.get(c.nodeId)?.kind === "intent" ? "these plans" : "this change");
    out.push({
      id: c._id,
      kind: c.relation === "ordering_dependency" ? "ordering" : c.type,
      classificationId: c._id,
      topic,
      owner: src.topicOwners.get(topic),
      t: c.at,
      detectedAfterMs: Math.max(0, c.at - Math.max(a.at, b.at)),
      rationale: clip(lbSentence(c.reason).replace(/^judge:\s*/i, ""), 240),
      comparison: c.comparison,
      sides: [a, b],
    });
  }
  return out.sort((x, y) => x.t - y.t).slice(0, DECISION_LIMIT);
}
