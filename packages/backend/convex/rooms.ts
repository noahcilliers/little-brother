import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { membership, requireMember, requireRoom, viewerMember, viewRoom } from "./access";
import { randomToken } from "./hash";
import { roomSessions } from "./sessionRows";

const newInvite = () => randomToken(12);
const MAX_ROOMS = 50;
const MAX_MEMBERS = 100;

async function addMember(ctx: MutationCtx, teamId: Id<"teams">, memberId: Id<"members">): Promise<void> {
  if (await membership(ctx, teamId, memberId)) return;
  await ctx.db.insert("roomMembers", { teamId, memberId, joinedAt: Date.now() });
}

/** The rooms the signed-in member belongs to, newest first. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const member = await viewerMember(ctx);
    if (!member) return [];
    const rows = await ctx.db
      .query("roomMembers")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .take(MAX_ROOMS);
    const out = [];
    for (const r of rows) {
      const team = await ctx.db.get(r.teamId);
      if (!team) continue;
      const people = await ctx.db
        .query("roomMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .take(MAX_MEMBERS);
      const sessions = await roomSessions(ctx, team._id);
      out.push({
        id: team._id,
        name: team.name,
        isOwner: team.ownerId === member.userId,
        members: people.length,
        sessions: sessions.length,
        live: sessions.reduce((n, s) => n + s.live, 0),
        joinedAt: r.joinedAt,
      });
    }
    return out.sort((a, b) => b.joinedAt - a.joinedAt);
  },
});

/** One room: its people, sessions, and (for members) the invite code. */
export const get = query({
  // A plain string: the id comes from the URL, and a malformed one should read as "not found", not throw.
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("teams", args.roomId);
    const room = roomId ? await viewRoom(ctx, roomId) : null;
    if (!roomId || !room) return null;
    const rows = await ctx.db
      .query("roomMembers")
      .withIndex("by_team", (q) => q.eq("teamId", roomId))
      .take(MAX_MEMBERS);
    const members = [];
    for (const r of rows) {
      const m = await ctx.db.get(r.memberId);
      if (m) members.push({ id: m._id, handle: m.handle, name: m.name, avatarUrl: m.avatarUrl ?? null });
    }
    return {
      id: room.team._id,
      name: room.team.name,
      isOwner: room.member !== null && room.team.ownerId === room.member.userId,
      inviteCode: room.member ? room.team.inviteCode : null,
      members,
      sessions: await roomSessions(ctx, roomId),
    };
  },
});

/** What an invite link opens into, shown before joining. */
export const preview = query({
  args: { invite: v.string() },
  handler: async (ctx, { invite }) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_invite", (q) => q.eq("inviteCode", invite))
      .first();
    return team ? { id: team._id, name: team.name } : null;
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const member = await requireMember(ctx);
    if (!member.userId) throw new ConvexError("Sign in with GitHub first.");
    const teamId = await ctx.db.insert("teams", {
      name: name.trim().slice(0, 60) || `${member.handle}'s room`,
      ownerId: member.userId,
      inviteCode: newInvite(),
      createdAt: Date.now(),
    });
    await addMember(ctx, teamId, member._id);
    return { roomId: teamId };
  },
});

export const join = mutation({
  args: { invite: v.string() },
  handler: async (ctx, { invite }) => {
    const member = await requireMember(ctx);
    const team = await ctx.db
      .query("teams")
      .withIndex("by_invite", (q) => q.eq("inviteCode", invite.trim()))
      .first();
    if (!team)
      throw new ConvexError("That invite link is no longer valid. Ask the room owner for a new one.");
    await addMember(ctx, team._id, member._id);
    return { roomId: team._id };
  },
});

/** Leaving hands ownership to the longest-standing member; the last one out closes the room. */
export const leave = mutation({
  args: { roomId: v.id("teams") },
  handler: async (ctx, { roomId }) => {
    const { team, member } = await requireRoom(ctx, roomId);
    const mine = await membership(ctx, roomId, member._id);
    if (mine) await ctx.db.delete(mine._id);
    const rest = await ctx.db
      .query("roomMembers")
      .withIndex("by_team", (q) => q.eq("teamId", roomId))
      .take(MAX_MEMBERS);
    if (rest.length === 0) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_team", (q) => q.eq("teamId", roomId))
        .collect();
      for (const s of sessions) if (!s.endedAt) await ctx.db.patch(s._id, { endedAt: Date.now() });
      await ctx.db.patch(roomId, { inviteCode: newInvite() });
      return null;
    }
    if (team.ownerId === member.userId) {
      const heir = await ctx.db.get(rest[0]?.memberId ?? member._id);
      if (heir?.userId) await ctx.db.patch(roomId, { ownerId: heir.userId });
    }
    return null;
  },
});

/** Owner only: old invite links stop working; people already in the room stay. */
export const rotateInvite = mutation({
  args: { roomId: v.id("teams") },
  handler: async (ctx, { roomId }) => {
    const { team, member } = await requireRoom(ctx, roomId);
    if (team.ownerId !== member.userId) throw new ConvexError("Only the room owner can reset the invite.");
    const inviteCode = newInvite();
    await ctx.db.patch(roomId, { inviteCode });
    return { inviteCode };
  },
});
