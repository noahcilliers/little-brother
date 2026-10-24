import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { board as boardView } from "./dashboardQueries/board";
import { verdictLog } from "./dashboardQueries/log";

// The read-only live view the host shares by link or QR: no sign-in, so every read checks the token and
// exposes only what the board and classifier log already show. Decisions stay with signed-in members.

const TOKEN = v.string();

async function byToken(ctx: QueryCtx, token: string): Promise<Doc<"sessions"> | null> {
  if (token.length < 16) return null;
  return ctx.db
    .query("sessions")
    .withIndex("by_watch", (q) => q.eq("watchToken", token))
    .first();
}

export const session = query({
  args: { token: TOKEN },
  handler: async (ctx, { token }) => {
    const s = await byToken(ctx, token);
    if (!s) return null;
    const team = await ctx.db.get(s.teamId);
    return { name: s.name, room: team?.name ?? "room", endedAt: s.endedAt ?? null };
  },
});

export const board = query({
  args: { token: TOKEN },
  handler: async (ctx, { token }) => {
    const s = await byToken(ctx, token);
    return s ? boardView(ctx, s._id) : null;
  },
});

export const log = query({
  args: { token: TOKEN },
  handler: async (ctx, { token }) => {
    const s = await byToken(ctx, token);
    return s ? verdictLog(ctx, s._id) : null;
  },
});
