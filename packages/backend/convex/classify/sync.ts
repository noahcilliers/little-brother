import { bySeverity, classifyStructural, interventionAction, type Judgment } from "@lb/core";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { claimGate, openConflictGate } from "./gate";
import { classifiedView, loadStructural, loadThresholds, toCandidates } from "./load";
import { persistJudgments, SYNC_SELF } from "./persist";
import { priorityLoader } from "./priority";

/**
 * Classifier steps 2–3 + 6 on the hook's hot path (PreToolUse budget < 150 ms): indexed reads and rules
 * only, no network. Returns non-ignore judgments, most severe first, and the catch rows they map to (a
 * repeat attempt maps to the catch already open, so it is denied again without a new row or notice). Pairwise ones are persisted (other
 * agents get inbox items; warnings are queued for this agent too, since the hook acts only on
 * serialize/block). Gate verdicts (open topic conflicts, collision claims held by another agent) point at an
 * already-open row, so they are returned, not stored.
 */
export type SyncResult = { judgments: Judgment[]; rowIds: Id<"classifications">[] };

export async function runSyncChecks(ctx: MutationCtx, nodeId: Id<"nodes">): Promise<SyncResult> {
  const next = await ctx.db.get(nodeId);
  if (!next) return { judgments: [], rowIds: [] };
  const now = Date.now();
  const priority = priorityLoader(ctx);
  const view = await classifiedView(next, priority);
  const nodes = await loadStructural(ctx, next, now);
  const candidates = await toCandidates(ctx, next, nodes, now, new Map(), priority);
  const { judgments } = classifyStructural(view, candidates, { thresholds: await loadThresholds(ctx) });
  const rows = await persistJudgments(ctx, next, judgments, { selfActions: SYNC_SELF });
  const gated = [...(await openConflictGate(ctx, next, view)), ...(await claimGate(ctx, next, view, now))];
  // The stored action wins: the intervention policy may have turned a denial into a hint.
  const applied: Judgment[] = [];
  for (const j of judgments) {
    const id = rows.get(j.otherNodeId);
    const row = id ? await ctx.db.get(id) : null;
    // Settled on the dashboard, by the owner, or by a landed push: that decision stands for later steps too.
    if (row && row.status !== "open") continue;
    const action =
      row && row.nodeId === nodeId
        ? row.action
        : interventionAction({ ...j, repeat: row !== null && row !== undefined });
    if (action !== "ignore") applied.push({ ...j, action });
  }
  return { judgments: [...gated, ...applied].sort(bySeverity), rowIds: [...new Set(rows.values())] };
}
