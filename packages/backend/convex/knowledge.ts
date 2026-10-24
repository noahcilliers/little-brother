import { type McpArgs, normalizeCommand, signatureLine } from "@lb/core";
import type { z } from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { resolveByDecision } from "./decisions";
import { sha1Hex } from "./hash";
import { insertNode, latestActions, topicFor } from "./nodes";

type Args<K extends keyof typeof McpArgs> = z.infer<(typeof McpArgs)[K]>;
export type Posted = { text: string; nodeId?: Id<"nodes"> };

const classify = (ctx: MutationCtx, nodeId: Id<"nodes">) =>
  ctx.scheduler.runAfter(0, internal.classify.run.classifyNode, { nodeId });

async function intentContext(ctx: MutationCtx, agent: Doc<"agents">) {
  const intent = agent.intentId ? await ctx.db.get(agent.intentId) : null;
  const actions = await latestActions(ctx, agent._id, 30);
  const files = [...new Set(actions.filter((a) => a.parentId === agent.intentId).flatMap((a) => a.files))];
  return { topic: intent?.topic, files: files.slice(0, 10) };
}

export async function postKnowledge(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  a: Args<"post_knowledge">,
): Promise<Posted> {
  const topic = a.topic ?? (await topicFor(ctx, agent.repo, a.files));
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "knowledge",
    verb: "LEARN",
    text: signatureLine({ verb: "LEARN", topic, target: a.fact }),
    topic,
    files: a.files,
    parentId: agent.intentId,
    outcome: "succeeded",
    at: Date.now(),
  });
  await classify(ctx, nodeId);
  return { text: `posted knowledge ${nodeId}`, nodeId };
}

export async function reportFailure(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  a: Args<"report_failure">,
): Promise<Posted> {
  const { topic, files } = await intentContext(ctx, agent);
  const worked = a.worked ? ` · worked: ${a.worked}` : "";
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "knowledge",
    verb: "LEARN",
    text: `${signatureLine({ verb: "LEARN", topic, target: a.tried, outcome: "failed" })} ${a.why}${worked}`,
    topic,
    files,
    parentId: agent.intentId,
    outcome: "failed",
    signature: await sha1Hex(normalizeCommand(a.tried)),
    at: Date.now(),
  });
  await classify(ctx, nodeId);
  return { text: `recorded failure ${nodeId}; other agents will be warned before repeating it`, nodeId };
}

export async function postDecision(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  a: Args<"post_decision">,
): Promise<Posted> {
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "action",
    verb: "DECIDE",
    text: signatureLine({ verb: "DECIDE", topic: a.topic, target: a.value }),
    label: `${a.topic} = ${a.value}`.slice(0, 120),
    topic: a.topic,
    parentId: agent.intentId,
    outcome: "succeeded",
    at: Date.now(),
  });
  const settled = await resolveByDecision(ctx, agent, a.topic, a.value, nodeId);
  await classify(ctx, nodeId);
  const note = settled ? `; settled ${settled} open conflict${settled > 1 ? "s" : ""}` : "";
  return { text: `decision ${a.topic} = ${a.value} posted (${nodeId})${note}`, nodeId };
}

export async function ask(ctx: MutationCtx, agent: Doc<"agents">, a: Args<"ask">): Promise<Posted> {
  const to = a.to ? `@${a.to.replace(/^@/, "")} ` : "";
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "knowledge",
    verb: "PLAN",
    text: `ASK ${to}${a.question}`,
    parentId: agent.intentId,
    outcome: "open",
    at: Date.now(),
  });
  return { text: `question posted; id ${nodeId}`, nodeId };
}

export async function answer(ctx: MutationCtx, agent: Doc<"agents">, a: Args<"answer">): Promise<Posted> {
  const questionId = ctx.db.normalizeId("nodes", a.questionId);
  const question = questionId ? await ctx.db.get(questionId) : null;
  if (question?.outcome === "open") await ctx.db.patch(question._id, { outcome: "succeeded" });
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "knowledge",
    verb: "LEARN",
    text: `ANSWER ${a.body}`,
    topic: question?.topic,
    parentId: question?._id,
    outcome: "succeeded",
    at: Date.now(),
  });
  return {
    text: question ? `answered ${question._id}` : `answer stored (${nodeId}); question id not found`,
    nodeId,
  };
}
