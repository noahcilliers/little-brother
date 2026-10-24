import { context, signatureLine } from "@lb/core";
import { internal } from "../_generated/api";
import { deliverPending } from "../digest";
import { insertNode, topicFor, topicFromText } from "../nodes";
import type { HookHandler } from "./types";

const oneLine = (s: string, n = 200) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export const onUserPromptSubmit: HookHandler = async ({ ctx, agent, env }) => {
  const prompt = env.prompt ?? env.preview ?? "";
  const topic =
    (await topicFor(ctx, agent.repo, env.files)) ?? (await topicFromText(ctx, agent.repo, env.prompt ?? ""));
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "intent",
    verb: "PLAN",
    text: signatureLine({ verb: "PLAN", topic, target: oneLine(prompt) }),
    topic,
    files: env.files,
    touches: env.touches,
    references: env.references,
    outcome: "open",
    at: Date.now(),
  });
  await ctx.db.patch(agent._id, { intentId: nodeId });
  await ctx.scheduler.runAfter(0, internal.classify.run.classifyNode, { nodeId });
  const pending = await deliverPending(ctx, agent._id);
  return { output: context("UserPromptSubmit", pending), summary: prompt, nodeId };
};
