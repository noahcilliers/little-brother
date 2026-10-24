import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireRoom, viewSession } from "./access";
import { freeCode, sessionForCode } from "./sessionRows";
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
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await viewSession(ctx, sessionId);
    if (!s) return null;
    const team = await ctx.db.get(s.teamId);
    return {
      id: s._id,
      name: s.name,
      code: s.code,
      endedAt: s.endedAt ?? null,
      room: { id: s.teamId, name: team?.name ?? "room" },
    };
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

/** `/little-brother:join <code>` from a connector: does this member's room have that open session? */
export const attach = internalMutation({
  args: { tokenHash: v.string(), code: v.string() },
  handler: async (ctx, { tokenHash, code }) => {
    const member = await memberByTokenHash(ctx, tokenHash);
    if (!member) throw new ConvexError("unauthorized");
    const s = await sessionForCode(ctx, member, code);
    if (!s) return null;
    const team = await ctx.db.get(s.teamId);
    return { code: s.code, name: s.name, room: team?.name ?? "room" };
  },
});
