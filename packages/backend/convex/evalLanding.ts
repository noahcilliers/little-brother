import type { LandingEvals } from "@lb/core";
import { query } from "./_generated/server";

// The landing's eval section, readable without signing in. Only published aggregates, one featured replay
// (already sanitized by the publisher) and the classifier benchmark: never prompts, tokens or member data.

const SUMMARY_LIMIT = 200;

const strip = <T extends { _id: unknown; _creationTime: unknown }>({ _id, _creationTime, ...rest }: T) =>
  rest;

export const landing = query({
  args: {},
  handler: async (ctx): Promise<LandingEvals> => {
    const summaries = await ctx.db.query("evalSummaries").take(SUMMARY_LIMIT);
    const featured = await ctx.db
      .query("evalReplays")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .order("desc")
      .first();
    const bench = await ctx.db.query("classifierBenches").withIndex("by_at").order("desc").first();
    let replay: LandingEvals["replay"] = null;
    if (featured) {
      const { featured: _featured, at: _at, ...rest } = strip(featured);
      replay = rest;
    }
    return { summaries: summaries.map(strip), replay, classifier: bench ? strip(bench) : null };
  },
});
