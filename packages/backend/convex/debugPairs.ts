import { v } from "convex/values";
import { stored } from "./classify/load";
import { internalMutation, internalQuery } from "./_generated/server";

/** Dev only: every classification with both sides' signatures, for tuning the judge. */
export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("classifications").collect();
    const out = [];
    for (const c of rows) {
      const a = await ctx.db.get(c.nodeId);
      const b = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
      out.push({
        src: c.source,
        rel: c.relation,
        act: c.action,
        next: a?.text,
        nextConsumes: a?.consumes,
        other: b?.text,
        otherKind: b?.kind,
      });
    }
    return out;
  },
});

/** Dev only: mark every agent active and touch recent nodes so a classifier re-run sees the live state. */
export const revive = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const a of await ctx.db.query("agents").collect())
      await ctx.db.patch(a._id, { status: "active", lastSeenAt: Date.now() });
    for (const n of await ctx.db.query("nodes").collect())
      await ctx.db.patch(n._id, { at: Date.now() - 60_000 });
  },
});

/** Dev only: two nodes by text fragment, as StoredNode-shaped objects. */
export const byText = internalQuery({
  args: { a: v.string(), b: v.string() },
  handler: async (ctx, { a, b }) => {
    const all = await ctx.db.query("nodes").collect();
    const find = (s: string) => all.find((n) => n.text.includes(s));
    const na = find(a);
    const nb = find(b);
    return na && nb ? { a: stored(na), b: stored(nb) } : null;
  },
});
