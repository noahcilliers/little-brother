import { SEED_VERBS } from "@lb/core";
import { internalMutation, type MutationCtx } from "./_generated/server";

const EVENT_TYPES = [
  {
    key: "conflict",
    enforcement: "block",
    description: "Another agent has an incompatible implementation of the same topic",
  },
  {
    key: "duplicate",
    enforcement: "warn",
    description: "The same task is already done or in progress by another agent",
  },
  { key: "stale", enforcement: "warn", description: "Follows a reasoning path already recorded as failed" },
  { key: "normal", enforcement: "silent", description: "No meaningful overlap" },
] as const;

/** Idempotent: inserts only missing rows, so it is safe to call on every join. */
export async function ensureSeed(ctx: MutationCtx): Promise<void> {
  for (const t of EVENT_TYPES) {
    const existing = await ctx.db
      .query("eventTypes")
      .withIndex("by_key", (q) => q.eq("key", t.key))
      .first();
    if (!existing) await ctx.db.insert("eventTypes", { ...t });
  }
  for (const verb of SEED_VERBS) {
    const existing = await ctx.db
      .query("verbs")
      .withIndex("by_key", (q) => q.eq("key", verb.key))
      .first();
    if (!existing) await ctx.db.insert("verbs", { ...verb, status: "active" });
  }
}

export const init = internalMutation({ args: {}, handler: ensureSeed });
