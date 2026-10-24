import { closeOpenTasks } from "../tasks";
import { lastTestPassed } from "./stop";
import type { HookHandler } from "./types";

export const onSessionEnd: HookHandler = async ({ ctx, agent }) => {
  await ctx.db.patch(agent._id, { status: "offline" });
  await closeOpenTasks(ctx, agent._id, await lastTestPassed(ctx, agent), Date.now());
  return { output: null, summary: "session ended" };
};
