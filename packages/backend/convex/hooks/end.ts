import type { HookHandler } from "./types";

export const onSessionEnd: HookHandler = async ({ ctx, agent }) => {
  await ctx.db.patch(agent._id, { status: "offline" });
  return { output: null, summary: "session ended" };
};
