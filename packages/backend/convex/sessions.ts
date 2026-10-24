import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { openMode, requireRoom, viewerMember, viewSession } from "./access";
import { requestOrJoin } from "./admission";
import { randomToken } from "./hash";
import { logForMember, writeLog } from "./serverLog";
import { freeCode, sessionByCode } from "./sessionRows";
import { memberByTokenHash } from "./tokenAuth";

export const create = mutation({
  args: { roomId: v.id("teams"), name: v.string() },
  handler: async (ctx, { roomId, name }) => {
    const { member } = await requireRoom(ctx, roomId);
    const code = await freeCode(ctx);
    const sessionId = await ctx.db.insert("sessions", {
      teamId: roomId,
      name: name.trim().slice(0, 80) || "Untitled session",
      code,
      createdBy: member._id,
      createdAt: Date.now(),
    });
    return { sessionId, code };
  },
});

/** Header for the session page: its name, join code and room. */
export const get = query({
  // A plain string: the id comes from the URL, and a malformed one should read as "not found", not throw.
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    const s = sessionId ? await viewSession(ctx, sessionId) : null;
    if (!s) return null;
    const team = await ctx.db.get(s.teamId);
    const me = await viewerMember(ctx);
    const isHost = team !== null && me !== null && team.ownerId === me.userId;
    return {
      isHost,
      // Join QR: members may share the invite; the watch link is the host's to hand out.
      inviteCode: me ? (team?.inviteCode ?? null) : null,
      watchToken: isHost ? (s.watchToken ?? null) : null,
      id: s._id,
      name: s.name,
      code: s.code,
      endedAt: s.endedAt ?? null,
      room: { id: s.teamId, name: team?.name ?? "room" },
    };
  },
});

/** Host only: turn the read-only live view on (a fresh link) or off (the old link stops working). */
export const setWatch = mutation({
  args: { sessionId: v.id("sessions"), on: v.boolean() },
  handler: async (ctx, { sessionId, on }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return null;
    const { team, member } = await requireRoom(ctx, s.teamId);
    if (team.ownerId !== member.userId) throw new ConvexError("Only the room's host can share a live view.");
    const watchToken = on ? randomToken(16) : undefined;
    await ctx.db.patch(sessionId, { watchToken });
    await writeLog(ctx, {
      teamId: s.teamId,
      sessionId,
      memberId: member._id,
      level: "info",
      kind: "watch",
      text: on
        ? `@${member.handle} shared a read-only live view`
        : `@${member.handle} turned the live view off`,
    });
    return { watchToken: watchToken ?? null };
  },
});

/** Ending stops recording: connectors still pointing at the code are ignored from then on. */
export const end = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return null;
    await requireRoom(ctx, s.teamId);
    if (!s.endedAt) await ctx.db.patch(sessionId, { endedAt: Date.now() });
    return null;
  },
});

export const reopen = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return null;
    await requireRoom(ctx, s.teamId);
    await ctx.db.patch(sessionId, { endedAt: undefined });
    return null;
  },
});

/**
 * `/little-brother:join <code>` from a connector. Someone not yet in the room lands in its waiting room;
 * their connector asks again on the next prompt and gets in once the host admits them.
 */
export const attach = internalMutation({
  args: { tokenHash: v.string(), code: v.string() },
  handler: async (ctx, { tokenHash, code }) => {
    const member = await memberByTokenHash(ctx, tokenHash);
    if (!member) throw new ConvexError("unauthorized");
    const s = await sessionByCode(ctx, member, code);
    const team = s ? await ctx.db.get(s.teamId) : null;
    if (!s || !team || s.endedAt) {
      await logForMember(ctx, member._id, {
        level: "warn",
        kind: "join-failed",
        text: `@${member.handle} tried code ${code}: ${s?.endedAt ? "that session has ended" : "no such session"}`,
      });
      return null;
    }
    const status = openMode() ? "member" : await requestOrJoin(ctx, team, member, "claude", s._id);
    if (status === "member")
      await writeLog(ctx, {
        teamId: team._id,
        sessionId: s._id,
        memberId: member._id,
        level: "info",
        kind: "attached",
        text: `@${member.handle} joined "${s.name}" from Claude Code`,
      });
    return {
      status: status === "member" ? ("joined" as const) : status,
      code: s.code,
      name: s.name,
      room: team.name,
    };
  },
});
