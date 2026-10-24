import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { missingSignInEnv, openMode, viewerMember } from "./access";
import { ensureMember } from "./teamMembers";

// The account: who is signed in. Rooms and sessions hang off the member row created here.

/** Public: what the front door needs before anyone signs in. Names missing env vars, never their values. */
export const status = query({
  args: {},
  handler: async () => {
    const missing = missingSignInEnv();
    return { signInReady: missing.length === 0, missing, openMode: openMode() };
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user) return null;
    const member = await viewerMember(ctx);
    const rooms = member
      ? await ctx.db
          .query("roomMembers")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .take(50)
      : [];
    return {
      user: { name: user.name ?? user.githubLogin ?? "you", login: user.githubLogin, image: user.image },
      member: member ? { id: member._id, handle: member.handle, name: member.name } : null,
      rooms: rooms.length,
    };
  },
});

/** First visit after sign-in: create the member row that laptops, rooms and sessions belong to. */
export const ensureAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in with GitHub first.");
    const member = await ensureMember(ctx, userId);
    return { handle: member.handle };
  },
});
