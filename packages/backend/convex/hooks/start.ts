import { context, TopicMap } from "@lb/core";
import type { MutationCtx } from "../_generated/server";
import { deliverPending, teamDigest } from "../digest";
import type { HookHandler } from "./types";

/** The repo's `.littlebrother.json` arrives with SessionStart; keep the latest per repo for topic lookup. */
async function storeTopicMap(ctx: MutationCtx, repo: string, raw: unknown) {
  const parsed = TopicMap.safeParse(raw);
  if (!parsed.success || Object.keys(parsed.data.topics).length === 0) return;
  const key = `topics:${repo}`;
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (row) await ctx.db.patch(row._id, { value: parsed.data });
  else await ctx.db.insert("settings", { key, value: parsed.data });
}

export const onSessionStart: HookHandler = async ({ ctx, agent, env }) => {
  if (env.topicMap) await storeTopicMap(ctx, agent.repo, env.topicMap);
  const digest = await teamDigest(ctx, agent, true);
  const pending = await deliverPending(ctx, agent._id);
  return {
    output: context("SessionStart", [digest, pending].filter(Boolean).join("\n\n")),
    summary: `session started on ${agent.branch}`,
  };
};
