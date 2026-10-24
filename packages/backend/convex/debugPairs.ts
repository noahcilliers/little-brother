import { classifyStructural, toClassifiedNode } from "@lb/core";
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { loadStructural, stored, toCandidates } from "./classify/load";

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

/** Dev only: what the async classifier would see for a node: candidates with retrieval reasons and scores. */
export const explain = internalQuery({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const all = await ctx.db.query("nodes").collect();
    const next = all.find((n) => n.text.includes(text));
    if (!next) return null;
    const now = Date.now();
    const cands = await toCandidates(ctx, next, await loadStructural(ctx, next, now), now);
    const view = toClassifiedNode(stored(next));
    const r = classifyStructural(view, cands, {});
    return {
      next: view.text,
      topic: view.topic,
      consumes: view.consumes,
      settled: r.judgments.map((j) => `${j.relation}/${j.action} vs ${j.otherNodeId}`),
      unsettled: r.unsettled.map(
        (u) =>
          `${u.pair.retrievalScore.toFixed(2)} ${u.pair.other.text.slice(0, 50)} :: ${u.pair.reasons.join("; ")}`,
      ),
    };
  },
});
