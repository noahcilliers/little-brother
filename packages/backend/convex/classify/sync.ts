import { bySeverity, classifyStructural, type Judgment } from "@lb/core";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { claimGate, openConflictGate } from "./gate";
import { classifiedView, loadStructural, loadThresholds, toCandidates } from "./load";
import { persistJudgments, SYNC_SELF } from "./persist";
import { priorityLoader } from "./priority";

/**
 * Classifier steps 2–3 + 6 on the hook's hot path (PreToolUse budget < 150 ms): indexed reads and rules
 * only, no network. Returns non-ignore judgments, most severe first. Pairwise ones are persisted (other
 * agents get inbox items; warnings are queued for this agent too, since the hook acts only on
 * serialize/block). Gate verdicts (open topic conflicts, collision claims held by another agent) point at an
 * already-open row, so they are returned, not stored.
 */
export async function runSyncChecks(ctx: MutationCtx, nodeId: Id<"nodes">): Promise<Judgment[]> {
  const next = await ctx.db.get(nodeId);
  if (!next) return [];
  const now = Date.now();
  const priority = priorityLoader(ctx);
  const view = await classifiedView(next, priority);
  const nodes = await loadStructural(ctx, next, now);
  const candidates = await toCandidates(ctx, next, nodes, now, new Map(), priority);
  const { judgments } = classifyStructural(view, candidates, { thresholds: await loadThresholds(ctx) });
  await persistJudgments(ctx, next, judgments, { selfActions: SYNC_SELF });
  const gated = [...(await openConflictGate(ctx, next, view)), ...(await claimGate(ctx, next, view, now))];
  return [...gated, ...judgments.filter((j) => j.action !== "ignore")].sort(bySeverity);
}
