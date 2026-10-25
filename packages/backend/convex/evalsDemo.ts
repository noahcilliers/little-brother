import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { demoSignInEnabled } from "./demoSignIn";
import { ensureMember } from "./teamMembers";

/**
 * For a recorded demo on a local backend: the demo-signed-in owner hosts the eval session's room, and the
 * agents' members belong to it, so the dashboard shows what a signed-in team sees.
 */
export const seat = internalMutation({
  args: { code: v.string(), owner: v.string(), handles: v.array(v.string()) },
  handler: async (ctx, { code, owner, handles }) => {
    if (!demoSignInEnabled()) throw new ConvexError("demo seating is local-only");
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", code.toLowerCase()))
      .first();
    if (!session) throw new ConvexError(`no session ${code}`);
    const user = (await ctx.db.query("users").collect()).find((u) => u.githubLogin === owner);
    if (!user) throw new ConvexError(`sign in as ${owner} first`);
    await ensureMember(ctx, user._id);
    await ctx.db.patch(session.teamId, { ownerId: user._id });
    for (const handle of handles) {
      const member = await ctx.db
        .query("members")
        .withIndex("by_handle", (q) => q.eq("handle", handle))
        .first();
      if (!member) continue;
      const seated = await ctx.db
        .query("roomMembers")
        .withIndex("by_member", (q) => q.eq("memberId", member._id).eq("teamId", session.teamId))
        .first();
      if (!seated)
        await ctx.db.insert("roomMembers", {
          teamId: session.teamId,
          memberId: member._id,
          joinedAt: Date.now(),
        });
    }
    return { teamId: session.teamId };
  },
});
