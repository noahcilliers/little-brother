import type { BoardCatch } from "./catches";
import type { BoardShared } from "./goals";
import type { LooseAction } from "./routine";
import type { Source } from "./source";
import type { BoardTask } from "./tasks";

// Token cost and savings. The schema's token fields are optional and may be missing on older rows, so every read
// is defensive, and each level falls back to the one below it: action → hook event, task → its actions.

/** An optional numeric field on a stored row, read without assuming the schema has it yet. */
export function numField(row: object, key: string): number | undefined {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

const sum = (xs: (number | undefined)[]): number | undefined => {
  const known = xs.filter((x): x is number => x !== undefined);
  return known.length ? known.reduce((a, b) => a + b, 0) : undefined;
};

/** Fills action and task token counts in place. */
export function fillTokens(src: Source, tasks: BoardTask[], loose: LooseAction[]) {
  const byEvent = new Map<string, number>();
  for (const e of src.events) {
    if (e.nodeId && e.tokens !== undefined && e.hook === "PreToolUse") byEvent.set(e.nodeId, e.tokens);
  }
  const nodes = new Map<string, object>(src.nodeById);
  const ofAction = (id: string) => {
    const n = nodes.get(id);
    return (n && numField(n, "tokens")) ?? byEvent.get(id);
  };
  const docs = new Map<string, object>(src.tasks.map((t) => [t._id, t]));
  for (const k of tasks) {
    for (const a of k.actions) a.tokens = ofAction(a.id);
    const doc = docs.get(k.id);
    k.tokens = (doc && numField(doc, "tokens")) ?? sum(k.actions.map((a) => a.tokens));
  }
  for (const a of loose) a.tokens = ofAction(a.id);
}

/**
 * What a catch saved, as the classifier recorded it; else an estimate: a duplicate or a repeated failure would
 * have cost about what the original attempt did.
 */
export function fillSavings(src: Source, catches: BoardCatch[], tasks: BoardTask[], shared: BoardShared[]) {
  const verdicts = new Map<string, object>(src.verdicts.map((c) => [c._id, c]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const sharedById = new Map(shared.map((s) => [s.id, s]));
  for (const c of catches) {
    const v = verdicts.get(c.classificationId);
    const recorded = v ? numField(v, "tokensSaved") : undefined;
    if (recorded !== undefined) {
      c.saved = recorded;
      continue;
    }
    if (c.kind !== "duplicate" && c.kind !== "stale") continue;
    const target = taskById.get(c.to) ?? taskById.get(sharedById.get(c.to)?.fromTask ?? "");
    c.saved = target?.tokens;
  }
}

/** Tokens each agent has spent in this session: its steps plus its loose routine actions. */
export function agentTokens(tasks: BoardTask[], loose: LooseAction[], agentId: string): number | undefined {
  return sum([
    ...tasks.filter((t) => t.agentId === agentId).map((t) => t.tokens),
    ...loose.filter((a) => a.agentId === agentId).map((a) => a.tokens),
  ]);
}
