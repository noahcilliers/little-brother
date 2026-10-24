import type { Start } from "./case";

export type AgentState = { startedAt: number | null; firstEditAt: number | null; doneAt: number | null };

export type Due = {
  at: number;
  /** The awaited event never happened; started when the other agent finished. */
  fallback: boolean;
};

/**
 * When an agent should get its prompt, or null while that still depends on an event that hasn't happened.
 * An agent waiting on `firstEdit` of one that finished without editing starts anyway, flagged as a fallback,
 * so a run never hangs on an agent that took another path.
 */
export function dueAt(
  start: Start | undefined,
  runStart: number,
  states: Map<string, AgentState>,
): Due | null {
  const delay = (start?.delaySec ?? 0) * 1000;
  const after = start?.after;
  if (!after) return { at: runStart + delay, fallback: false };
  const dep = states.get(after.agent);
  if (!dep) return null;
  const hit = after.event === "firstEdit" ? dep.firstEditAt : dep.doneAt;
  if (hit !== null) return { at: hit + delay, fallback: false };
  if (after.event === "firstEdit" && dep.doneAt !== null) return { at: dep.doneAt + delay, fallback: true };
  return null;
}
