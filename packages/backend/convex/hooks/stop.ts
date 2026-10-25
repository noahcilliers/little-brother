import { blockStop, DASHBOARD_DECIDES, renderDigest } from "@lb/core";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { classifyPool } from "../classify/pool";
import { unackedUrgent } from "../inbox";
import { closeOpenTasks } from "../tasks";
import { applyToolTokens } from "../tokens";
import type { HookHandler } from "./types";

const MAX_STOP_BLOCKS = 1;

/** A trajectory fails when its last test (or, lacking tests, last command) failed. */
async function trajectoryOutcome(ctx: MutationCtx, intent: Doc<"nodes">): Promise<"succeeded" | "failed"> {
  const nodes = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", intent.agentId).gte("at", intent.at))
    .order("desc")
    .collect();
  const finished = nodes.filter((n) => n.parentId === intent._id && n.outcome !== "open");
  const last = finished.find((n) => n.verb === "TEST") ?? finished.find((n) => n.verb === "RUN");
  return last?.outcome === "failed" ? "failed" : "succeeded";
}

/** Whether the agent's current trajectory ended green (no tests counts as green). */
export async function lastTestPassed(ctx: MutationCtx, agent: Doc<"agents">): Promise<boolean> {
  const intent = agent.intentId ? await ctx.db.get(agent.intentId) : null;
  return !intent || (await trajectoryOutcome(ctx, intent)) === "succeeded";
}

async function closeIntent(ctx: MutationCtx, agent: Doc<"agents">): Promise<string> {
  const intent = agent.intentId ? await ctx.db.get(agent.intentId) : null;
  if (intent?.outcome !== "open") return "stopped";
  const outcome = await trajectoryOutcome(ctx, intent);
  const text = `${intent.text.replace(/ → (OK|FAIL)$/, "")} → ${outcome === "failed" ? "FAIL" : "OK"}`;
  await ctx.db.patch(intent._id, { outcome, text });
  await classifyPool.enqueueAction(ctx, internal.classify.run.onTrajectoryEnd, { intentId: intent._id });
  return `stopped, intent ${outcome}`;
}

export const onStop: HookHandler = async ({ ctx, agent, env }) => {
  await applyToolTokens(ctx, agent, env.toolTokens);
  // Only a conflict waiting on a person holds the agent back. Ordinary notices were already delivered with the
  // hooks; demanding acks for them cost a model turn each and changed nothing the agent did.
  const urgent = (await unackedUrgent(ctx, agent._id)).filter((i) => i.action === "block");
  const attempts = Math.max(0, ...urgent.map((i) => i.attempts));
  if (urgent.length > 0 && !env.stopHookActive && attempts < MAX_STOP_BLOCKS) {
    for (const item of urgent) {
      await ctx.db.patch(item._id, { attempts: item.attempts + 1, state: "delivered" });
    }
    const digest = renderDigest(urgent.map((i) => ({ id: i._id, text: i.text })));
    // A hold is either a decision waiting on a person (an enforcing catch nobody has a claim on) or work only this
    // agent can do before it stops, like keeping an interface it changed working for a caller's branch.
    const rows = await Promise.all(urgent.map((i) => ctx.db.get(i.classificationId)));
    const waitsOnPerson = rows.some(
      (c) => c !== null && (c.action === "block" || c.action === "serialize") && !c.winnerAgentId,
    );
    const reason = waitsOnPerson
      ? `${digest}\n${DASHBOARD_DECIDES} Avoid the contested change until then, or stop.`
      : `${digest}\nDo this before you finish; it's what keeps the merge working.`;
    return {
      output: blockStop(reason),
      summary: `stop blocked by ${urgent.length} item(s)`,
      tokens: env.tokens,
    };
  }
  const summary = await closeIntent(ctx, agent);
  await closeOpenTasks(ctx, agent._id, await lastTestPassed(ctx, agent), Date.now(), env.preview);
  return { output: null, summary, tokens: env.tokens };
};
