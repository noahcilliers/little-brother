import type { Id } from "../_generated/dataModel";
import { lbSentence, lowerFirst, subjectThing } from "./labels";
import { type Klass, payloadField } from "./shared";
import type { Source } from "./source";
import type { BoardTask } from "./tasks";

export type CatchKind = "duplicate" | "stale" | "conflict" | "ordering" | "takeover";
export type BoardCatch = {
  id: string;
  classificationId: Id<"classifications">;
  kind: CatchKind;
  /** Task id, a lesson/decision id, or a goal id when a plan was caught before it had a task. */
  from: string;
  to: string;
  t: number;
  /** When it settled; null while still open. */
  until: number | null;
  status: Klass["status"];
  /** How it was settled and by whom: "kept JWT tokens", "ash on the dashboard". */
  resolution?: string;
  resolvedBy?: string;
  topic?: string;
  /** Short label for the chip on the edge: "conflict · auth.mechanism", "needs JWT tokens first". */
  chip: string;
  text: string;
  /** Tokens this catch saved (recorded, or estimated from the attempt it prevented repeating). */
  saved?: number;
};

// A catch with no recorded settle time stays drawn this long after it fired.
const SETTLE_MS = 3000;

function kindOf(c: Klass, src: Source): CatchKind | undefined {
  if (c.type === "normal") return undefined;
  if (c.relation === "ordering_dependency") return "ordering";
  // The priority policy gave the claim to the newer change: the other side is told to stop.
  const next = src.nodeById.get(c.nodeId);
  if (c.winnerAgentId && next && c.winnerAgentId === next.agentId) return "takeover";
  return c.type;
}

function chipOf(kind: CatchKind, topic: string | undefined, to: BoardTask | undefined): string {
  switch (kind) {
    case "conflict":
      return topic ? `conflict · ${topic}` : "conflict";
    case "duplicate":
      return "duplicate";
    case "stale":
      return "already failed";
    case "ordering":
      return `needs ${to ? lowerFirst(subjectThing(to.subject)) : "the other side"} first`;
    case "takeover":
      return "takeover";
  }
}

/** Catches link the task that was caught to the task (or lesson, decision) it was caught against. */
export function buildCatches(
  src: Source,
  tasks: BoardTask[],
  taskOfNode: Map<string, string>,
  sharedIds: Set<string>,
): BoardCatch[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  // Plans are caught before any code exists: draw them from the goal's first task, or the goal flag itself.
  const firstTask = new Map<string, string>();
  for (const t of [...tasks].sort((a, b) => a.t0 - b.t0))
    if (t.goalId && !firstTask.has(t.goalId)) firstTask.set(t.goalId, t.id);
  const anchor = (id: Id<"nodes"> | undefined) => {
    if (!id) return undefined;
    const direct = taskOfNode.get(id) ?? (sharedIds.has(id) ? id : undefined);
    if (direct) return direct;
    return src.nodeById.get(id)?.kind === "intent" ? (firstTask.get(id) ?? id) : undefined;
  };
  const resolvedAt = new Map<string, number>();
  for (const e of src.events) {
    const cid = payloadField(e, "classificationId");
    if (e.hook === "Resolve" && typeof cid === "string") resolvedAt.set(cid, e.at);
  }

  const byPair = new Map<string, BoardCatch>();
  for (const c of [...src.verdicts].sort((a, b) => a.at - b.at)) {
    const kind = kindOf(c, src);
    const from = anchor(c.nodeId);
    const to = anchor(c.againstNodeId);
    if (!kind || !from || !to || from === to) continue;
    const fromTask = taskById.get(from);
    // A denial nobody holds a claim on waits for a person (the dashboard decides); the rest settle when the step ends.
    const waits =
      kind !== "ordering" &&
      c.status === "open" &&
      (c.action === "block" || c.action === "serialize") &&
      !c.winnerAgentId;
    // An ordering wait lasts as long as the waiting step does.
    const ordering = kind === "ordering" && c.status === "open";
    const settled =
      c.resolvedAt ??
      resolvedAt.get(c._id) ??
      (waits ? null : ordering ? (fromTask?.t1 ?? null) : Math.max(fromTask?.t1 ?? 0, c.at + SETTLE_MS));
    const key = `${kind}:${from}:${to}`;
    const prev = byPair.get(key);
    if (prev) {
      // Repeated verdicts on one pair are one catch: it stays open while any of them is.
      if (prev.until !== null) prev.until = settled === null ? null : Math.max(prev.until, settled);
      if (c.status === "open") Object.assign(prev, { classificationId: c._id, status: c.status });
      else if (c.resolvedBy && prev.status === "open" && prev.until !== null)
        Object.assign(prev, { status: c.status, resolution: c.resolution, resolvedBy: c.resolvedBy });
      continue;
    }
    const topic =
      src.nodeById.get(c.nodeId)?.topic ?? (c.againstNodeId && src.nodeById.get(c.againstNodeId)?.topic);
    byPair.set(key, {
      id: c._id,
      classificationId: c._id,
      kind,
      from,
      to,
      t: c.at,
      until: settled,
      status: c.status,
      ...(c.resolvedBy ? { resolution: c.resolution, resolvedBy: c.resolvedBy } : {}),
      topic: topic || undefined,
      chip: chipOf(kind, topic || undefined, taskById.get(to)),
      text: lbSentence(c.reason),
    });
  }
  return [...byPair.values()];
}
