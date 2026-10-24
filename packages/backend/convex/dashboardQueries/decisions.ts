import type { Id } from "../_generated/dataModel";
import { clip, lbSentence, subjectThing } from "./labels";
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
 * Conflicts a person has to settle: open, enforcing (block or serialize), and with no claim already given to one
 * side by the priority policy (that is a takeover, which needs nobody).
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
      (taskId && taskById.get(taskId)?.subject) || n.label || n.files[0] || n.verb.toLowerCase();
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
    const needed =
      c.type === "conflict" &&
      c.status === "open" &&
      (c.action === "block" || c.action === "serialize") &&
      !c.winnerAgentId &&
      c.relation !== "ordering_dependency";
    if (!needed || !c.againstNodeId) continue;
    const a = side(c.againstNodeId);
    const b = side(c.nodeId);
    if (!a || !b) continue;
    const topic =
      src.nodeById.get(c.nodeId)?.topic ?? src.nodeById.get(c.againstNodeId)?.topic ?? "this change";
    out.push({
      id: c._id,
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
