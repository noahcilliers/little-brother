import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ensureSeed } from "./seed";

/** Create the member or rotate its token; only the hash is stored. */
export const join = internalMutation({
  args: { handle: v.string(), name: v.optional(v.string()), tokenHash: v.string() },
  handler: async (ctx, { handle, name, tokenHash }) => {
    await ensureSeed(ctx);
    const existing = await ctx.db
      .query("members")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { tokenHash, revoked: false, name: name ?? existing.name });
      return existing._id;
    }
    return ctx.db.insert("members", { handle, name: name ?? handle, tokenHash, revoked: false });
  },
});
