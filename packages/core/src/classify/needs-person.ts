import { isInterfaceChange } from "./catch";
import type { Relation } from "./types";

export type CatchRow = {
  type: string;
  relation: string;
  action: string;
  status: string;
  evidence: string[];
  winnerAgentId?: unknown;
};

/**
 * A catch only a person can settle, shown on the dashboard: open, with no claim already given to one side, and
 * either enforcing or two goals that contradict each other. Plans that contradict are only a warning to the
 * agents (a model can't stop work on wording alone), but which approach wins is exactly a team's call.
 * Interface clashes are excluded: each side is told its own mechanical fix.
 */
export function needsPerson(c: CatchRow): boolean {
  if (c.type === "normal" || c.status !== "open" || c.winnerAgentId) return false;
  if (isInterfaceChange({ relation: c.relation as Relation, evidence: c.evidence })) return false;
  return c.action === "block" || c.action === "serialize" || c.relation === "intent_contradiction";
}
