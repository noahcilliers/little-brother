import { FEATURE_NAMES, FEATURE_VERSION, PAIR_MODEL_KEY, parsePairModel } from "@lb/core";
import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";

// The learned pair model lives in `settings`, so a retrained model ships with one `npx convex run`, no deploy.

const PREVIOUS_KEY = `${PAIR_MODEL_KEY}:previous`;
const EXPECT = { featureVersion: FEATURE_VERSION, featureNames: FEATURE_NAMES };

async function upsert(ctx: MutationCtx, key: string, value: unknown): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (row) await ctx.db.patch(row._id, { value });
  else await ctx.db.insert("settings", { key, value });
}

/** The stored entry ({ version, uploadedAt, model }), unvalidated: the action parses it and fails open itself. */
export const current = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", PAIR_MODEL_KEY))
      .first();
    const value: unknown = row?.value;
    return value ?? null;
  },
});

/**
 * `npx convex run classify/pairModel:upload '{"model": …}'`. Refuses a model this build can't read (wrong
 * shape or feature set) and keeps the one it replaces under `:previous` for a one-command rollback.
 */
export const upload = internalMutation({
  args: { model: v.any() },
  handler: async (ctx, { model }) => {
    const parsed = parsePairModel(model, EXPECT);
    if (!parsed.ok) throw new Error(`pair model rejected: ${parsed.error}`);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", PAIR_MODEL_KEY))
      .first();
    if (row) await upsert(ctx, PREVIOUS_KEY, row.value);
    const m = parsed.model;
    await upsert(ctx, PAIR_MODEL_KEY, { version: m.version, uploadedAt: Date.now(), model });
    return { version: m.version, estimator: m.estimator.kind, classes: m.classes, synthetic: m.synthetic };
  },
});

/** Swap back to the model the last upload replaced. */
export const rollback = internalMutation({
  args: {},
  handler: async (ctx) => {
    const prev = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", PREVIOUS_KEY))
      .first();
    if (!prev) return { rolledBack: false };
    await upsert(ctx, PAIR_MODEL_KEY, prev.value);
    await ctx.db.delete(prev._id);
    return { rolledBack: true };
  },
});
