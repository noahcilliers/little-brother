import { type HookOutput, IngestEnvelope, TASK_TOOLS } from "@lb/core";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { upsertAgent } from "./agents";
import { memberByTokenHash } from "./auth";
import { onSessionEnd } from "./hooks/end";
import { onPostToolUse } from "./hooks/post";
import { onPreToolUse } from "./hooks/pre";
import { onUserPromptSubmit } from "./hooks/prompt";
import { onSessionStart } from "./hooks/start";
import { onStop } from "./hooks/stop";
import { onTaskEvent, onTaskTool } from "./hooks/task";
import type { HookHandler, HookResult } from "./hooks/types";

const HANDLERS: Record<string, HookHandler> = {
  SessionStart: onSessionStart,
  UserPromptSubmit: onUserPromptSubmit,
  PreToolUse: onPreToolUse,
  PostToolUse: onPostToolUse,
  PostToolUseFailure: onPostToolUse,
  Stop: onStop,
  SessionEnd: onSessionEnd,
  TaskCreated: onTaskEvent,
  TaskCompleted: onTaskEvent,
};
const TOOL_HOOKS = new Set(["PreToolUse", "PostToolUse", "PostToolUseFailure"]);

/** Task-list tool calls are plan bookkeeping, routed away from the action-node handlers. */
function handlerFor(hook: string, tool: string | undefined): HookHandler | undefined {
  if (TOOL_HOOKS.has(hook) && tool && TASK_TOOLS.has(tool)) return onTaskTool;
  return HANDLERS[hook];
}

type IngestResult = { status: 200 | 401; output: HookOutput };

/** One transaction per hook: dedupe, log, update the graph, and compute the reply together. */
export const ingest = internalMutation({
  args: { tokenHash: v.string(), hook: v.string(), envelope: v.any() },
  handler: async (ctx, args): Promise<IngestResult> => {
    const member = await memberByTokenHash(ctx, args.tokenHash);
    if (!member) return { status: 401, output: null };
    const env = IngestEnvelope.parse(args.envelope);
    const seen = await ctx.db
      .query("events")
      .withIndex("by_key", (q) => q.eq("eventKey", env.eventKey))
      .first();
    if (seen) return { status: 200, output: (seen.payload?.output ?? null) as HookOutput };

    const now = Date.now();
    const agent = await upsertAgent(ctx, member._id, env.session, now, env.baseRev);
    const eventId = await ctx.db.insert("events", {
      agentId: agent._id,
      eventKey: env.eventKey,
      source: "hook",
      hook: args.hook,
      tool: env.tool,
      files: env.files,
      summary: args.hook,
      payload: { envelope: env, output: null },
      at: now,
    });
    const handler = handlerFor(args.hook, env.tool);
    const result: HookResult = handler
      ? await handler({ ctx, hook: args.hook, agent, env, eventId })
      : { output: null, summary: args.hook };
    await ctx.db.patch(eventId, {
      nodeId: result.nodeId,
      tokens: result.tokens,
      summary: result.summary,
      payload: { envelope: env, output: result.output },
    });
    return { status: 200, output: result.output };
  },
});
