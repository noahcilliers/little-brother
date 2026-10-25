import { summarizeEvalRuns } from "@lb/core";
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { classifierBench, evalBatchConfig, evalReplay, evalRunRow } from "./schemaEvals";

// Ingest for published eval results, called by apps/evals publish-cli.ts through `npx convex run` and by
// the harness's live stream through httpEvals.ts. Every write upserts by its key, so re-publishing a
// results dir, or re-posting a run, changes nothing.

const strip = <T extends { _id: unknown; _creationTime: unknown }>({ _id, _creationTime, ...rest }: T) =>
  rest;

async function refreshSummaries(ctx: MutationCtx, batch: string): Promise<number> {
  const rows = await ctx.db
    .query("evalRuns")
    .withIndex("by_batch", (q) => q.eq("batch", batch))
    .collect();
  const old = await ctx.db
    .query("evalSummaries")
    .withIndex("by_batch", (q) => q.eq("batch", batch))
    .collect();
  for (const s of old) await ctx.db.delete(s._id);
  const fresh = summarizeEvalRuns(rows.map(strip));
  for (const s of fresh) await ctx.db.insert("evalSummaries", s);
  return fresh.length;
}

export const ingestRuns = internalMutation({
  args: { rows: v.array(evalRunRow) },
  handler: async (ctx, { rows }) => {
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("evalRuns")
        .withIndex("by_key", (q) => q.eq("runKey", row.runKey))
        .first();
      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated += 1;
      } else {
        await ctx.db.insert("evalRuns", row);
        inserted += 1;
      }
    }
    let summaries = 0;
    for (const batch of new Set(rows.map((r) => r.batch))) summaries += await refreshSummaries(ctx, batch);
    return { inserted, updated, summaries };
  },
});

/** Stores a run's replay; a featured one becomes the landing's, and the previous one steps down. */
export const ingestReplay = internalMutation({
  args: { replay: evalReplay, featured: v.boolean() },
  handler: async (ctx, { replay, featured }) => {
    if (featured) {
      const current = await ctx.db
        .query("evalReplays")
        .withIndex("by_featured", (q) => q.eq("featured", true))
        .collect();
      for (const r of current) if (r.runKey !== replay.runKey) await ctx.db.patch(r._id, { featured: false });
    }
    const existing = await ctx.db
      .query("evalReplays")
      .withIndex("by_key", (q) => q.eq("runKey", replay.runKey))
      .first();
    // The live stream stores caught runs unfeatured; re-posting one must not demote the landing's pick.
    const doc = { ...replay, featured: featured || (existing?.featured ?? false), at: Date.now() };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("evalReplays", doc);
    return { runKey: replay.runKey, featured };
  },
});

/** A live batch's plan, then its finish: the harness posts the same label twice, so this upserts. */
export const upsertBatch = internalMutation({
  args: { config: evalBatchConfig },
  handler: async (ctx, { config }) => {
    const existing = await ctx.db
      .query("evalBatches")
      .withIndex("by_batch", (q) => q.eq("batch", config.batch))
      .first();
    if (existing) await ctx.db.replace(existing._id, config);
    else await ctx.db.insert("evalBatches", config);
    return { batch: config.batch };
  },
});

export const ingestClassifier = internalMutation({
  args: { bench: classifierBench },
  handler: async (ctx, { bench }) => {
    const existing = await ctx.db
      .query("classifierBenches")
      .withIndex("by_version", (q) => q.eq("version", bench.version))
      .first();
    if (existing) await ctx.db.replace(existing._id, bench);
    else await ctx.db.insert("classifierBenches", bench);
    return { version: bench.version };
  },
});
