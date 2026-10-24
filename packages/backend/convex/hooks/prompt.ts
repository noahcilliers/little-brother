import { cleanPrompt, context, signatureLine } from "@lb/core";
import { internal } from "../_generated/api";
import { classifyPool } from "../classify/pool";
import { deliverPending } from "../digest";
import { insertNode, topicFor, topicFromText } from "../nodes";
import { closeInferredTasks } from "../taskAttribution";
import type { HookHandler } from "./types";

const oneLine = (s: string, n = 200) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export const onUserPromptSubmit: HookHandler = async ({ ctx, agent, env }) => {
  const prompt = cleanPrompt(env.prompt ?? env.preview ?? "");
  // Harness-only prompts (task notifications, reminders) carry no intent; just deliver what is queued.
  if (!prompt)
    return { output: context("UserPromptSubmit", await deliverPending(ctx, agent._id)), summary: "" };
  const topic =
    (await topicFor(ctx, agent.repo, env.files)) ?? (await topicFromText(ctx, agent.repo, prompt));
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
  await closeInferredTasks(ctx, agent._id, Date.now());
  await classifyPool.enqueueAction(ctx, internal.classify.run.classifyNode, { nodeId });
  const pending = await deliverPending(ctx, agent._id);
  return { output: context("UserPromptSubmit", pending), summary: prompt, nodeId };
};
