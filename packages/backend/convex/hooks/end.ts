import { closeOpenTasks } from "../tasks";
import { applyToolTokens } from "../tokens";
import { lastTestPassed } from "./stop";
import type { HookHandler } from "./types";

export const onSessionEnd: HookHandler = async ({ ctx, agent, env }) => {
  await applyToolTokens(ctx, agent, env.toolTokens);
  await ctx.db.patch(agent._id, { status: "offline" });
  await closeOpenTasks(ctx, agent._id, await lastTestPassed(ctx, agent), Date.now());
  return { output: null, summary: "session ended" };
};

/** PreCompact: the transcript is about to be summarized, so record its per-call tokens first. */
export const onPreCompact: HookHandler = async ({ ctx, agent, env }) => {
  const patched = await applyToolTokens(ctx, agent, env.toolTokens);
  return { output: null, summary: `compacting; ${patched} tool call(s) priced` };
};
