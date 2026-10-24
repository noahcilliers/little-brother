import { internalMutation } from "./_generated/server";

const RUNTIME_TABLES = [
  "inbox",
  "classifications",
  "events",
  "nodes",
  "agents",
  "members",
  "settings",
] as const;

/** Dev only: wipe runtime data before a demo run. Lookup tables (verbs, eventTypes) are kept. */
export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    for (const table of RUNTIME_TABLES) {
      for (const row of await ctx.db.query(table).collect()) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
