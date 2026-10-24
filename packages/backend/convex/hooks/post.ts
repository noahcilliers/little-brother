import {
  actionLabel,
  commandFailed,
  context,
  deriveVerb,
  type IngestEnvelope,
  signatureLine,
} from "@lb/core";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { classifyPool } from "../classify/pool";
import { deliverPending } from "../digest";
import { applyGitOp } from "../git";
import {
  actionSignature,
  actionTarget,
  activeVerbs,
  consumesFor,
  insertNode,
  latestActions,
  topicFor,
} from "../nodes";
import { taskForAction } from "../taskAttribution";
import { failRevertedEdits } from "./revert";
import type { HookHandler } from "./types";

const sameFiles = (a: string[], b: string[]) =>
  a.length > 0 && a.length === b.length && a.every((f) => b.includes(f));

/** Match by tool_use_id when the connector sent one; otherwise the latest open action by signature or files. */
async function findOpenAction(ctx: QueryCtx, agentId: Doc<"agents">["_id"], env: IngestEnvelope) {
  if (env.toolUseId) {
    const byId = await ctx.db
      .query("nodes")
      .withIndex("by_tool_use", (q) => q.eq("toolUseId", env.toolUseId))
      .first();
    if (byId && byId.agentId === agentId) return byId;
  }
  const signature = await actionSignature(env);
  const recent = await latestActions(ctx, agentId, 30);
  return recent.find(
    (n) => n.outcome === "open" && (n.signature === signature || sameFiles(n.files, env.files)),
  );
}

export const onPostToolUse: HookHandler = async ({ ctx, hook, agent, env }) => {
  const target = actionTarget(env);
  const tool = env.tool ?? "";
  const matched = deriveVerb(await activeVerbs(ctx), { tool, input: env.command ?? env.files.join(" ") });
  const existing = matched === "EXPLORE" ? undefined : await findOpenAction(ctx, agent._id, env);
  const base = existing?.verb ?? matched;
  const failed = commandFailed({
    hookFailed: hook === "PostToolUseFailure",
    exitCode: env.exitCode,
    verb: base,
    output: env.outputTail,
  });
  const outcome = failed ? "failed" : "succeeded";
  const reverting = !failed && (env.reverted?.length ?? 0) > 0;
  // A restore names its own verb so it never reads as the trajectory's last command run.
  const verb = reverting && base === "RUN" ? "REVERT" : base;

  let nodeId: Doc<"nodes">["_id"];
  const now = Date.now();
  const labelFor = (v: string) =>
    actionLabel({ verb: v, tool, touches: env.touches, files: env.files, command: env.command });
  if (existing) {
    nodeId = existing._id;
    // Nodes from before task attribution (or whose PreToolUse was not hooked) get theirs now.
    const label = existing.label ?? labelFor(verb);
    const taskId =
      existing.taskId ?? (await taskForAction(ctx, agent, { verb, topic: existing.topic, label, at: now }));
    await ctx.db.patch(nodeId, {
      verb,
      outcome,
      text: signatureLine({ verb, topic: existing.topic, target, outcome }),
      label,
      taskId,
    });
  } else {
    const topic = await topicFor(ctx, agent.repo, env.files);
    const label = labelFor(verb);
    const taskId = await taskForAction(ctx, agent, { verb, topic, label, at: now });
    nodeId = await insertNode(ctx, {
      agentId: agent._id,
      kind: "action",
      verb,
      text: signatureLine({ verb, topic, target, outcome: verb === "EXPLORE" ? undefined : outcome }),
      topic,
      files: env.files,
      touches: env.touches,
      references: env.references,
      parentId: agent.intentId,
      outcome,
      signature: await actionSignature(env),
      toolUseId: env.toolUseId,
      taskId,
      label,
      baseRev: env.baseRev,
      preview: env.preview?.slice(0, 1500),
      consumes: await consumesFor(ctx, agent.repo, env.files),
      at: now,
    });
  }
  const landed = env.git ? await applyGitOp(ctx, agent, env.git) : "";
  const discarded = reverting ? await failRevertedEdits(ctx, agent, env.reverted ?? [], now) : 0;
  const summary = `${tool} ${target} → ${failed ? "FAIL" : "OK"}${landed}${discarded ? `, ${discarded} edit(s) failed` : ""}`;
  // Reads are context, not work, and undoing your own change can't collide with anyone: record, don't classify.
  if (verb === "EXPLORE" || verb === "REVERT") return { output: null, summary, nodeId };

  await classifyPool.enqueueAction(ctx, internal.classify.run.classifyNode, { nodeId });
  // Claude Code only accepts additionalContext tagged PostToolUse; failure hooks leave items queued for the next hook.
  if (hook !== "PostToolUse") return { output: null, summary, nodeId };
  return { output: context("PostToolUse", await deliverPending(ctx, agent._id, ["warn"])), summary, nodeId };
};
