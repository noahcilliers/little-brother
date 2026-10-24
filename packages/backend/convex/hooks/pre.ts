import { ACTION_RANK, actionLabel, deny, deriveVerb, type Judgment, signatureLine, TYPE_OF } from "@lb/core";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { runSyncChecks } from "../classify/sync";
import { markDeliveredIds, queuedItems } from "../inbox";
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
import { stopOnDeny } from "../tasks";
import type { HookHandler } from "./types";

/** Outcome of the last finished action in the current trajectory, so an edit after a failure becomes FIX. */
async function prevOutcome(ctx: QueryCtx, agent: Doc<"agents">): Promise<"ok" | "fail" | undefined> {
  const recent = await latestActions(ctx, agent._id, 20);
  const last = recent.find((n) => n.parentId === agent.intentId && n.outcome !== "open");
  if (!last) return undefined;
  return last.outcome === "failed" ? "fail" : "ok";
}

export function renderDenial(judgments: Judgment[]): string | null {
  const urgent = judgments
    .filter((j) => j.action === "serialize" || j.action === "block")
    .sort((a, b) => ACTION_RANK[b.action] - ACTION_RANK[a.action] || b.confidence - a.confidence);
  if (urgent.length === 0) return null;
  const lines = urgent.slice(0, 3).map((j) => `${TYPE_OF[j.relation]} · ${j.evidence.join(" ")}`);
  return `[little-brother] ${lines.join("\n")}`;
}

export const onPreToolUse: HookHandler = async ({ ctx, agent, env, eventId }) => {
  const tool = env.tool ?? "";
  const verb = deriveVerb(await activeVerbs(ctx), {
    tool,
    input: env.command ?? env.files.join(" "),
    prevOutcome: await prevOutcome(ctx, agent),
  });
  const topic = await topicFor(ctx, agent.repo, env.files);
  const target = actionTarget(env);
  const now = Date.now();
  const label = actionLabel({ verb, tool, touches: env.touches, files: env.files, command: env.command });
  const taskId = await taskForAction(ctx, agent, { verb, topic, label, at: now });
  const nodeId = await insertNode(ctx, {
    agentId: agent._id,
    kind: "action",
    verb,
    text: signatureLine({ verb, topic, target }),
    topic,
    files: env.files,
    touches: env.touches,
    references: env.references,
    parentId: agent.intentId,
    outcome: "open",
    signature: await actionSignature(env),
    toolUseId: env.toolUseId,
    taskId,
    label,
    baseRev: env.baseRev,
    preview: env.preview?.slice(0, 1500),
    consumes: await consumesFor(ctx, agent.repo, env.files),
    at: now,
  });
  // Linked before the checks run so classifications can find the event that triggered them.
  await ctx.db.patch(eventId, { nodeId });
  const judgments = await runSyncChecks(ctx, nodeId);
  // Prefer the classifier's rendered reason (owner names, what to do instead); fall back to raw evidence.
  const stored = await ctx.db
    .query("classifications")
    .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
    .collect();
  // Equal severity: a known failure is the most actionable explanation, then duplicates, then conflicts.
  const explains = { stale: 0, duplicate: 1, conflict: 2, normal: 3 } as const;
  const urgentReasons = stored
    .filter((c) => c.action === "serialize" || c.action === "block")
    .sort(
      (a, b) =>
        ACTION_RANK[b.action] - ACTION_RANK[a.action] ||
        explains[a.type] - explains[b.type] ||
        b.confidence - a.confidence,
    )
    .map((c) => c.reason.replace(/^\[little-brother\]\s*/, ""));
  const reason = urgentReasons.length
    ? `[little-brother] ${urgentReasons.slice(0, 3).join("\n")}`
    : renderDenial(judgments);
  if (!reason) return { output: null, summary: `${tool} ${target}`, nodeId };
  // Warnings still queued for this agent (often the same lesson, found async from its prompt) ride along
  // with the denial instead of arriving again on the next hook.
  const pendingWarns = await queuedItems(ctx, agent._id, ["warn"]);
  await markDeliveredIds(
    ctx,
    pendingWarns.map((i) => i._id),
  );
  const extra = pendingWarns
    .map((i) => i.text.replace(/^\[little-brother\]\s*/, ""))
    .filter((t) => !reason.includes(t.slice(0, 80)));
  const fullReason = extra.length ? `${reason}\n${extra.slice(0, 2).join("\n")}` : reason;
  // A denied call never runs, so it must not linger as open work for other agents to collide with.
  await ctx.db.patch(nodeId, { outcome: "superseded" });
  await stopOnDeny(ctx, taskId, reason, now);
  return { output: deny(fullReason), summary: `denied ${tool} ${target}`, nodeId };
};
