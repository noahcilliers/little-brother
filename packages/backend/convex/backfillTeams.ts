import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

// One-off: rows written before nodes and classifications carried `teamId` get their author's room, so the
// room-scoped classifier reads still see old failure memory and open conflicts. Run once per deployment:
// `npx convex run backfillTeams:run '{}'`. It reschedules itself page by page and is safe to re-run.

const PAGE = 300;

async function teamOfAgent(
  ctx: MutationCtx,
  cache: Map<string, Id<"teams"> | undefined>,
  agentId: Id<"agents">,
): Promise<Id<"teams"> | undefined> {
  if (!cache.has(agentId)) cache.set(agentId, (await ctx.db.get(agentId))?.teamId);
  return cache.get(agentId);
}

export const run = internalMutation({
  args: {
    table: v.optional(v.union(v.literal("nodes"), v.literal("classifications"))),
    cursor: v.optional(v.union(v.string(), v.null())),
    patched: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const table = a.table ?? "nodes";
    const cache = new Map<string, Id<"teams"> | undefined>();
    let patched = a.patched ?? 0;
    const page = await ctx.db.query(table).paginate({ numItems: PAGE, cursor: a.cursor ?? null });
    for (const row of page.page) {
      if (row.teamId) continue;
      const agentId = "agentId" in row ? row.agentId : row.agentIds[0];
      const teamId = agentId ? await teamOfAgent(ctx, cache, agentId) : undefined;
      if (!teamId) continue;
      await ctx.db.patch(row._id, { teamId });
      patched++;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.backfillTeams.run, {
        table,
        cursor: page.continueCursor,
        patched,
      });
      return { table, patched, done: false };
    }
    if (table === "nodes") {
      await ctx.scheduler.runAfter(0, internal.backfillTeams.run, { table: "classifications" });
      return { table, patched, done: false };
    }
    return { table, patched, done: true };
  },
});
