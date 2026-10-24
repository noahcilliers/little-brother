import { cleanPrompt } from "@lb/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sessionAgents } from "../sessionRows";

// The classifier's own record for one session: every step it judged, grouped by the step, with each
// comparison's verdict, who settled it (rule, LLM judge or fallback), confidence, reason and latency.

const VERDICT_SCAN = 1500;
const STEP_LIMIT = 80;

export type LogVerdict = {
  id: string;
  against: { handle: string; text: string } | null;
  relation: string;
  type: Doc<"classifications">["type"];
  action: Doc<"classifications">["action"];
  source: Doc<"classifications">["source"];
  confidence: number;
  reason: string;
  evidence: string[];
  latencyMs: number;
  status: Doc<"classifications">["status"];
};
export type LogStep = {
  nodeId: string;
  /** The agent that took the step; the room-wide log maps it to its session. */
  agentId: string;
  at: number;
  handle: string;
  kind: string;
  text: string;
  verdicts: LogVerdict[];
};

const tidy = (text: string) => cleanPrompt(text.replace(/^\[little-brother\]\s*/, ""));

export async function verdictLog(ctx: QueryCtx, sessionId: Id<"sessions">): Promise<LogStep[]> {
  return verdictLogFor(ctx, await sessionAgents(ctx, sessionId));
}

/** The same record for any set of agents, e.g. every agent in a room's recent sessions. */
export async function verdictLogFor(ctx: QueryCtx, agents: Doc<"agents">[]): Promise<LogStep[]> {
  const mine = new Set<string>(agents.map((a) => a._id));
  const handles = new Map<string, string>();
  for (const a of agents) handles.set(a._id, (await ctx.db.get(a.memberId))?.handle ?? "agent");
  const handleOf = async (agentId: Id<"agents">) => {
    const known = handles.get(agentId);
    if (known) return known;
    const agent = await ctx.db.get(agentId);
    const handle = agent ? ((await ctx.db.get(agent.memberId))?.handle ?? "agent") : "agent";
    handles.set(agentId, handle);
    return handle;
  };

  const rows = (await ctx.db.query("classifications").order("desc").take(VERDICT_SCAN)).filter((c) =>
    mine.has(c.agentIds[0] ?? ""),
  );
  const steps = new Map<string, LogStep>();
  for (const c of rows) {
    let step = steps.get(c.nodeId);
    if (!step) {
      if (steps.size >= STEP_LIMIT) continue;
      const node = await ctx.db.get(c.nodeId);
      if (!node) continue;
      step = {
        nodeId: c.nodeId,
        agentId: node.agentId,
        at: node.at,
        handle: await handleOf(node.agentId),
        kind: node.kind,
        text: tidy(node.text),
        verdicts: [],
      };
      steps.set(c.nodeId, step);
    }
    const other = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
    step.verdicts.push({
      id: c._id,
      against: other ? { handle: await handleOf(other.agentId), text: tidy(other.text) } : null,
      relation: c.relation,
      type: c.type,
      action: c.action,
      source: c.source,
      confidence: c.confidence,
      // Non-catches store only "independent (llm, 0.90)"; the judge's own rationale is in the evidence.
      reason: tidy(
        c.type === "normal" ? (c.evidence.find((e) => e.startsWith("judge:")) ?? c.reason) : c.reason,
      ),
      evidence: c.evidence.slice(0, 6),
      latencyMs: c.latencyMs,
      status: c.status,
    });
  }
  return [...steps.values()].sort((a, b) => b.at - a.at);
}
