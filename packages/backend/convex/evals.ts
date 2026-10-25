import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { stored } from "./classify/load";

// Readback for apps/evals. Each eval run gets its own room: failure memory is room-wide, so runs sharing
// the local open-mode room would see each other's failed attempts as `stale`.

const RUNNER = "eval-runner";
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

async function sessionByCode(ctx: QueryCtx, code: string): Promise<Doc<"sessions"> | null> {
  return ctx.db
    .query("sessions")
    .withIndex("by_code", (q) => q.eq("code", code.toLowerCase()))
    .first();
}

export const openRun = internalMutation({
  // `room` names the room for recorded demos; eval runs keep the "eval …" name that marks them as such.
  args: { code: v.string(), name: v.string(), room: v.optional(v.string()) },
  handler: async (ctx, { code, name, room }) => {
    if (await sessionByCode(ctx, code)) throw new Error(`session code ${code} is taken`);
    const runner =
      (await ctx.db
        .query("members")
        .withIndex("by_handle", (q) => q.eq("handle", RUNNER))
        .first()) ??
      (await ctx.db.get(await ctx.db.insert("members", { name: RUNNER, handle: RUNNER, revoked: false })));
    if (!runner) throw new Error("runner member insert failed");
    const now = Date.now();
    const teamId = await ctx.db.insert("teams", {
      name: room ?? `eval ${name}`,
      inviteCode: `eval-${code}`,
      createdAt: now,
    });
    await ctx.db.insert("sessions", {
      teamId,
      name,
      code: code.toLowerCase(),
      createdBy: runner._id,
      createdAt: now,
    });
    return { code: code.toLowerCase() };
  },
});

/** Ends the run: agents held open by the harness go offline and the session stops recording. */
export const closeRun = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const session = await sessionByCode(ctx, code);
    if (!session) return { closed: 0 };
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_lb_session", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const a of agents) await ctx.db.patch(a._id, { status: "offline" });
    await ctx.db.patch(session._id, { endedAt: Date.now() });
    return { closed: agents.length };
  },
});

async function handleOf(ctx: QueryCtx, cache: Map<string, string>, agentId: Id<"agents">): Promise<string> {
  const hit = cache.get(agentId);
  if (hit) return hit;
  const agent = await ctx.db.get(agentId);
  const member = agent ? await ctx.db.get(agent.memberId) : null;
  const handle = member?.handle ?? `unknown:${agentId}`;
  cache.set(agentId, handle);
  return handle;
}

export const snapshot = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const session = await sessionByCode(ctx, code);
    if (!session) return null;
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_lb_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const handles = new Map<string, string>();
    const agentRows = [];
    const classifications = [];
    for (const a of agents) {
      const handle = await handleOf(ctx, handles, a._id);
      const events = await ctx.db
        .query("events")
        .withIndex("by_agent_time", (q) => q.eq("agentId", a._id))
        .collect();
      const firstEdit = events.find((e) => e.hook === "PostToolUse" && e.tool && EDIT_TOOLS.has(e.tool));
      agentRows.push({
        handle,
        claudeSessionId: a.claudeSessionId,
        status: a.status,
        events: events.length,
        firstEventAt: events[0]?.at ?? null,
        firstEditAt: firstEdit?.at ?? null,
      });
      const nodes = await ctx.db
        .query("nodes")
        .withIndex("by_agent", (q) => q.eq("agentId", a._id))
        .collect();
      for (const n of nodes) {
        const rows = await ctx.db
          .query("classifications")
          .withIndex("by_node", (q) => q.eq("nodeId", n._id))
          .collect();
        for (const c of rows) {
          const against = c.againstNodeId ? await ctx.db.get(c.againstNodeId) : null;
          const inbox = await ctx.db
            .query("inbox")
            .withIndex("by_classification", (q) => q.eq("classificationId", c._id))
            .collect();
          const pairHandles = [];
          for (const id of c.agentIds) pairHandles.push(await handleOf(ctx, handles, id));
          classifications.push({
            id: c._id,
            type: c.type,
            relation: c.relation,
            action: c.action,
            source: c.source,
            agents: pairHandles,
            confidence: c.confidence,
            reason: c.reason,
            evidence: c.evidence.slice(0, 4),
            nodeKind: n.kind,
            nodeText: n.text,
            againstText: against?.text ?? null,
            inbox: inbox.length,
            latencyMs: c.latencyMs,
            tokensSaved: c.tokensSaved ?? null,
            catchKey: c.catchKey ?? null,
            at: c.at,
            // Both nodes in full, so apps/evals can turn a run into labelled training pairs (export-pairs.ts).
            retrievalScore: c.retrievalScore,
            direction: c.direction,
            pair: { next: stored(n), other: against ? stored(against) : null, evidence: c.evidence },
          });
        }
      }
    }
    return { code: session.code, agents: agentRows, classifications };
  },
});
