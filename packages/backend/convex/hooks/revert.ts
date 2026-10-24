import { revertedEdits } from "@lb/core";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const TRAJECTORY_CAP = 500;

/**
 * A git checkout/restore after a red test throws the attempt away. Mark the edits it discarded failed, so
 * they are failure memory for the next agent (R10) and the trajectory distills into a FAIL lesson, with or
 * without a model. Returns how many edits were marked.
 */
export async function failRevertedEdits(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  paths: string[],
  at: number,
): Promise<number> {
  const intent = agent.intentId ? await ctx.db.get(agent.intentId) : null;
  if (!intent) return 0;
  const nodes = (
    await ctx.db
      .query("nodes")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id).gte("at", intent.at))
      .take(TRAJECTORY_CAP)
  ).filter((n) => n.parentId === intent._id && n.kind === "action");
  const ids = new Set(
    revertedEdits(
      nodes.map((n) => ({ ...n, id: n._id })),
      { paths, at },
    ),
  );
  for (const n of nodes) {
    if (!ids.has(n._id)) continue;
    await ctx.db.patch(n._id, { outcome: "failed", text: `${n.text.replace(/ → (OK|FAIL)$/, "")} → FAIL` });
  }
  return ids.size;
}
