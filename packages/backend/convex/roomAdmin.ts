import { PAIR_MODEL_KEY } from "@lb/core";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { membership, requireRoom, viewerMember, viewRoom } from "./access";
import { addMember } from "./admission";
import { writeLog } from "./serverLog";

// The host's controls: the waiting room, who stays in, and whether the room needs approval at all.

async function requireOwner(ctx: QueryCtx | MutationCtx, roomId: Id<"teams">) {
  const room = await requireRoom(ctx, roomId);
  if (room.team.ownerId !== room.member.userId) throw new ConvexError("Only the room's host can do that.");
  return room;
}

/** Pending requests, for the host; empty for everyone else so the panel can mount anywhere. */
export const requests = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("teams", args.roomId);
    const room = roomId ? await viewRoom(ctx, roomId) : null;
    if (!roomId || !room?.member || room.team.ownerId !== room.member.userId) return [];
    const rows = await ctx.db
      .query("joinRequests")
      .withIndex("by_team_status", (q) => q.eq("teamId", roomId).eq("status", "pending"))
      .take(50);
    const out = [];
    for (const r of rows) {
      const m = await ctx.db.get(r.memberId);
      const s = r.sessionId ? await ctx.db.get(r.sessionId) : null;
      if (m)
        out.push({
          id: r._id,
          handle: m.handle,
          name: m.name,
          avatarUrl: m.avatarUrl ?? null,
          via: r.via,
          session: s?.name ?? null,
          at: r.createdAt,
        });
    }
    return out;
  },
});

export const decide = mutation({
  args: { requestId: v.id("joinRequests"), admit: v.boolean() },
  handler: async (ctx, { requestId, admit }) => {
    const r = await ctx.db.get(requestId);
    if (!r) return null;
    const { member: host } = await requireOwner(ctx, r.teamId);
    await ctx.db.patch(requestId, { status: admit ? "admitted" : "denied", decidedAt: Date.now() });
    if (admit) await addMember(ctx, r.teamId, r.memberId);
    const who = (await ctx.db.get(r.memberId))?.handle ?? "someone";
    await writeLog(ctx, {
      teamId: r.teamId,
      memberId: r.memberId,
      sessionId: r.sessionId,
      level: "info",
      kind: admit ? "admitted" : "denied",
      text: `@${host.handle} ${admit ? "admitted" : "denied"} @${who}`,
    });
    return null;
  },
});

/** Host only: takes someone out of the room; their Claude sessions stop being recorded at once. */
export const removeMember = mutation({
  args: { roomId: v.id("teams"), memberId: v.id("members") },
  handler: async (ctx, { roomId, memberId }) => {
    const { team, member: host } = await requireOwner(ctx, roomId);
    const target = await ctx.db.get(memberId);
    if (!target || target.userId === team.ownerId) throw new ConvexError("The host can't be removed.");
    const row = await membership(ctx, roomId, memberId);
    if (row) await ctx.db.delete(row._id);
    await writeLog(ctx, {
      teamId: roomId,
      memberId,
      level: "warn",
      kind: "removed",
      text: `@${host.handle} removed @${target.handle}`,
    });
    return null;
  },
});

export const setAdmission = mutation({
  args: { roomId: v.id("teams"), admission: v.union(v.literal("approval"), v.literal("open")) },
  handler: async (ctx, { roomId, admission }) => {
    const { member: host } = await requireOwner(ctx, roomId);
    await ctx.db.patch(roomId, { admission });
    await writeLog(ctx, {
      teamId: roomId,
      level: "info",
      kind: "settings",
      text: `@${host.handle} set the room to ${admission === "open" ? "open: anyone with the link joins" : "approval: the host admits each person"}`,
    });
    return null;
  },
});

/** For the person waiting: where their request stands, so their page can move on when admitted. */
export const myStatus = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("teams", args.roomId);
    const member = await viewerMember(ctx);
    if (!roomId || !member) return null;
    if (await membership(ctx, roomId, member._id)) return "member" as const;
    const last = await ctx.db
      .query("joinRequests")
      .withIndex("by_member_team", (q) => q.eq("memberId", member._id).eq("teamId", roomId))
      .order("desc")
      .first();
    return last?.status === "pending" || last?.status === "denied" ? last.status : null;
  },
});

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

/** Host only: which classifier this room runs. */
export const setClassifier = mutation({
  args: {
    roomId: v.id("teams"),
    classifier: v.union(
      v.literal("model+gemini"),
      v.literal("model+claude"),
      v.literal("gemini"),
      v.literal("claude"),
      v.literal("model"),
      v.literal("rules"),
    ),
  },
  handler: async (ctx, { roomId, classifier }) => {
    const { member: host } = await requireOwner(ctx, roomId);
    await ctx.db.patch(roomId, { classifier });
    await writeLog(ctx, {
      teamId: roomId,
      level: "info",
      kind: "settings",
      text: `@${host.handle} set the classifier to ${classifier}`,
    });
    return null;
  },
});

/** What the classifier setting can offer on this deployment: which providers have keys, whether our model is uploaded. */
export const classifierOptions = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("teams", args.roomId);
    const room = roomId ? await viewRoom(ctx, roomId) : null;
    if (!room) return null;
    const model = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", PAIR_MODEL_KEY))
      .first();
    const version = (model?.value as { version?: unknown } | undefined)?.version;
    return {
      current: room.team.classifier ?? "model+gemini",
      isHost: room.member !== null && room.team.ownerId === room.member.userId,
      gemini: !!process.env.GEMINI_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      model: typeof version === "string" ? version : null,
    };
  },
});
