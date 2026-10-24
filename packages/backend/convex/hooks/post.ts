import { context, deriveVerb, type IngestEnvelope, signatureLine } from "@lb/core";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
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
  const failed = hook === "PostToolUseFailure" || (env.exitCode !== undefined && env.exitCode !== 0);
  const outcome = failed ? "failed" : "succeeded";
  const target = actionTarget(env);
  const tool = env.tool ?? "";
  const derived = deriveVerb(await activeVerbs(ctx), { tool, input: env.command ?? env.files.join(" ") });
  const existing = derived === "EXPLORE" ? undefined : await findOpenAction(ctx, agent._id, env);

  let nodeId: Doc<"nodes">["_id"];
  let verb = derived;
  if (existing) {
    nodeId = existing._id;
    verb = existing.verb;
    await ctx.db.patch(nodeId, {
      outcome,
      text: signatureLine({ verb, topic: existing.topic, target, outcome }),
    });
  } else {
    const topic = await topicFor(ctx, agent.repo, env.files);
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
      baseRev: env.baseRev,
      preview: env.preview?.slice(0, 1500),
      consumes: await consumesFor(ctx, agent.repo, env.files),
      at: Date.now(),
    });
  }
  const landed = env.git ? await applyGitOp(ctx, agent, env.git) : "";
  const summary = `${tool} ${target} → ${failed ? "FAIL" : "OK"}${landed}`;
  // Reads are context, not work: recording them is enough, classifying them would only add noise.
  if (verb === "EXPLORE") return { output: null, summary, nodeId };

  await ctx.scheduler.runAfter(0, internal.classify.run.classifyNode, { nodeId });
  // Claude Code only accepts additionalContext tagged PostToolUse; failure hooks leave items queued for the next hook.
  if (hook !== "PostToolUse") return { output: null, summary, nodeId };
  return { output: context("PostToolUse", await deliverPending(ctx, agent._id, ["warn"])), summary, nodeId };
};
