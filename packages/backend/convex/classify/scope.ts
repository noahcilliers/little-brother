import { ACTIVE_WINDOW_MS, isFailureMemory } from "@lb/core";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Hot-path retrieval reads only what a candidate can come from (see toCandidates): active work from other
// live agents in the same session, failure memory from the same room. Scanning the newest rows of the whole
// deployment instead cost ~570 document reads per PreToolUse, and on a busy deployment pushed a teammate's
// open work out of the window, so real clashes went unseen.

/** Open work older than this is treated as abandoned rather than active. */
const OPEN_WINDOW_MS = 12 * 60 * 60 * 1000;
const SESSION_AGENTS_CAP = 50;
const PER_AGENT_OPEN_CAP = 50;
const PER_AGENT_FINISHED_CAP = 100;
const FAILED_CAP = 200;
const LESSON_CAP = 50;

/** Other live agents' open work, and work they finished within the active window, in `me`'s session. */
export async function sessionWork(ctx: QueryCtx, me: Doc<"agents">, now: number): Promise<Doc<"nodes">[]> {
  // Agents without a session (rows from before sessions existed) count as one shared session, as in
  // toCandidates; an index lookup on `undefined` matches exactly those.
  const sessionId = me.sessionId;
  const peers = (
    await ctx.db
      .query("agents")
      .withIndex("by_lb_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(SESSION_AGENTS_CAP)
  ).filter((a) => a._id !== me._id && a.status !== "offline");
  const out: Doc<"nodes">[] = [];
  for (const peer of peers) {
    const recent = (outcome: "open" | "succeeded", since: number, cap: number) =>
      ctx.db
        .query("nodes")
        .withIndex("by_agent_outcome", (q) =>
          q.eq("agentId", peer._id).eq("outcome", outcome).gte("at", since),
        )
        .order("desc")
        .take(cap);
    out.push(
      ...(await recent("open", now - OPEN_WINDOW_MS, PER_AGENT_OPEN_CAP)),
      ...(await recent("succeeded", now - ACTIVE_WINDOW_MS, PER_AGENT_FINISHED_CAP)),
    );
  }
  return out;
}

/** The room's failed work on the same files, and its recent lessons about failures. */
export async function roomFailures(
  ctx: QueryCtx,
  next: Doc<"nodes">,
  teamId: Doc<"nodes">["teamId"],
  now: number,
): Promise<Doc<"nodes">[]> {
  const failed = await ctx.db
    .query("nodes")
    .withIndex("by_team_outcome", (q) => q.eq("teamId", teamId).eq("outcome", "failed"))
    .order("desc")
    .take(FAILED_CAP);
  const files = new Set(next.files.concat(next.touches.map((t) => t.path)));
  const nearby = failed.filter(
    (n) => n.files.some((f) => files.has(f)) || n.touches.some((t) => files.has(t.path)),
  );
  const lessons = await ctx.db
    .query("nodes")
    .withIndex("by_team_kind", (q) =>
      q
        .eq("teamId", teamId)
        .eq("kind", "knowledge")
        .gte("at", now - ACTIVE_WINDOW_MS),
    )
    .order("desc")
    .take(LESSON_CAP);
  return [...nearby, ...lessons.filter(isFailureMemory)];
}
