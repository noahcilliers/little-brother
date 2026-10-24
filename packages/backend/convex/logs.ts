import { v } from "convex/values";
import { query } from "./_generated/server";
import { viewRoom } from "./access";
import { roomLog } from "./dashboardQueries/roomLog";

/** The host's log for the whole room: every recent session's hooks, server lines and verdicts. Host only. */
export const room = query({
  // A plain string: the id comes from the URL, and a malformed one should read as "not found", not throw.
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("teams", args.roomId);
    const room = roomId ? await viewRoom(ctx, roomId) : null;
    if (!roomId || !room?.member || room.team.ownerId !== room.member.userId) return null;
    return roomLog(ctx, roomId);
  },
});
