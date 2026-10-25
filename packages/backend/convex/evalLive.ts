import { type BenchmarkBoard, benchmarkBatches, benchRun } from "@lb/core";
import { query } from "./_generated/server";

// The public /benchmarks page, readable without signing in and live through useQuery: batch progress,
// per-arm aggregates and the latest graded runs. Outcome numbers only: never prompts, transcripts, tokens
// or member data.

const BATCH_LIMIT = 24;
const SUMMARY_LIMIT = 300;
const FEED_LIMIT = 20;

const strip = <T extends { _id: unknown; _creationTime: unknown }>({ _id, _creationTime, ...rest }: T) =>
  rest;

export const board = query({
  args: {},
  handler: async (ctx): Promise<BenchmarkBoard> => {
    const configs = await ctx.db.query("evalBatches").withIndex("by_started").order("desc").take(BATCH_LIMIT);
    // Summaries are rewritten on every ingest, so newest-first keeps a running batch's arms in the window.
    const summaries = await ctx.db.query("evalSummaries").order("desc").take(SUMMARY_LIMIT);
    // Creation order is arrival order: an upsert replaces in place, so a re-post doesn't jump the feed.
    const latest = await ctx.db.query("evalRuns").order("desc").take(FEED_LIMIT);
    return {
      batches: benchmarkBatches(configs.map(strip), summaries.map(strip)),
      feed: latest.map((r) => benchRun(strip(r), r._creationTime)),
    };
  },
});
