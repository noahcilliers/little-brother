import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertSession, viewRoom, viewSession } from "./access";
import { board as boardView } from "./dashboardQueries/board";
import { verdictLog } from "./dashboardQueries/log";
import { serverLog as serverRows } from "./dashboardQueries/serverRows";

const ALERT_WINDOW_MS = 30 * 60_000;

// Read model for apps/web: one session at a time, for members of its room (anyone in local open mode).
// The handler lives in dashboardQueries/ so each piece stays small; this file only fixes the public API name.

export const board = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    if (!sessionId || !(await viewSession(ctx, sessionId))) return null;
    return boardView(ctx, sessionId);
  },
});

/** The classifier log: every step judged in this session, newest first, with each comparison's verdict. */
export const log = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    if (!sessionId || !(await viewSession(ctx, sessionId))) return null;
    return verdictLog(ctx, sessionId);
  },
});

/** The host's server log for a session: hooks as they arrived and what the server did with them. Host only. */
export const serverLog = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    const session = sessionId ? await viewSession(ctx, sessionId) : null;
    if (!session) return null;
    const room = await viewRoom(ctx, session.teamId);
    if (!room?.member || room.team.ownerId !== room.member.userId) return null;
    return serverRows(ctx, session);
  },
});

/** The host's recent server warnings for this session (and room-wide ones), for live toasts. Host only. */
export const alerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    const session = sessionId ? await viewSession(ctx, sessionId) : null;
    if (!session) return [];
    const room = await viewRoom(ctx, session.teamId);
    if (!room?.member || room.team.ownerId !== room.member.userId) return [];
    const rows = await ctx.db
      .query("serverLog")
      .withIndex("by_team", (q) => q.eq("teamId", session.teamId).gte("at", Date.now() - ALERT_WINDOW_MS))
      .order("desc")
      .take(100);
    return rows
      .filter((r) => r.level !== "info" && (!r.sessionId || r.sessionId === session._id))
      .slice(0, 15)
      .map((r) => ({ id: r._id, at: r.at, level: r.level, kind: r.kind, text: r.text }));
  },
});

/** Where a decision's inbox items are: queued, or delivered into each agent's session. */
export const delivery = query({
  args: { classificationId: v.id("classifications") },
  handler: async (ctx, { classificationId }) => {
    const agentId = (await ctx.db.get(classificationId))?.agentIds[0];
    const agent = agentId ? await ctx.db.get(agentId) : null;
    if (!agent?.sessionId) return [];
    await assertSession(ctx, agent.sessionId);
    const items = await ctx.db
      .query("inbox")
      .withIndex("by_classification", (q) => q.eq("classificationId", classificationId))
      .take(20);
    const out = [];
    for (const i of items) {
      const agent = await ctx.db.get(i.agentId);
      const member = agent ? await ctx.db.get(agent.memberId) : null;
      out.push({ id: i._id, handle: member?.handle ?? "agent", state: i.state, action: i.action, at: i.at });
    }
    return out;
  },
});
