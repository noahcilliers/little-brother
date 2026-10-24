import { precisionByRelation, recalibrate } from "@lb/core";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { loadThresholds, THRESHOLDS_KEY } from "./load";

const PRECISION_KEY = "classifier:precision";
const SCAN = 2000;

async function upsert(ctx: MutationCtx, key: string, value: unknown): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (row) await ctx.db.patch(row._id, { value });
  else await ctx.db.insert("settings", { key, value });
}

/** Cron entry point (§5): per-relation precision from feedback → `settings`, and re-fit action thresholds. */
export const calibrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("classifications").order("desc").take(SCAN);
    const stats = precisionByRelation(rows.filter((r) => r.feedback !== undefined));
    await upsert(ctx, PRECISION_KEY, { at: Date.now(), stats });
    await upsert(ctx, THRESHOLDS_KEY, recalibrate(await loadThresholds(ctx), stats));
    return stats;
  },
});
