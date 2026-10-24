import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { missingSignInEnv, openMode, theTeam, viewerMember } from "./access";
import { randomToken } from "./hash";
import { ensureMember } from "./teamMembers";

const newInvite = () => randomToken(12);

async function signedInUser(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Sign in with GitHub first.");
  return userId;
}

/** Public: what the front door needs before anyone signs in. Names missing env vars, never their values. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const team = await theTeam(ctx);
    const missing = missingSignInEnv();
    return { signInReady: missing.length === 0, missing, hasTeam: team !== null, openMode: openMode() };
  },
});

/** The signed-in user, their member row and the team. The invite code is shown to members only. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user) return null;
    const team = await theTeam(ctx);
    const member = await viewerMember(ctx);
    return {
      user: { name: user.name ?? user.githubLogin ?? "you", login: user.githubLogin, image: user.image },
      member: member ? { id: member._id, handle: member.handle, name: member.name } : null,
      team: team
        ? {
            name: team.name,
            isOwner: team.ownerId === user._id,
            inviteCode: member ? team.inviteCode : null,
          }
        : null,
    };
  },
});

/** The first signed-in user creates the deployment's one team and owns it. */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await signedInUser(ctx);
    if (await theTeam(ctx)) throw new ConvexError("This deployment already has a team. Ask for an invite link.");
    const clean = name.trim().slice(0, 60) || "My team";
    await ctx.db.insert("teams", { name: clean, ownerId: userId, inviteCode: newInvite(), createdAt: Date.now() });
    const member = await ensureMember(ctx, userId);
    return { handle: member.handle };
  },
});

/** Join through the owner's invite link. Already-joined members pass straight through. */
export const join = mutation({
  args: { invite: v.string() },
  handler: async (ctx, { invite }) => {
    const userId = await signedInUser(ctx);
    const team = await theTeam(ctx);
    if (!team) throw new ConvexError("No team yet. Sign in without an invite to create one.");
    if (!(await viewerMember(ctx)) && invite !== team.inviteCode)
      throw new ConvexError("That invite link is no longer valid. Ask the owner for a new one.");
    const member = await ensureMember(ctx, userId);
    return { handle: member.handle };
  },
});

/** Owner only: old invite links stop working; already-joined members are unaffected. */
export const rotateInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await signedInUser(ctx);
    const team = await theTeam(ctx);
    if (!team || team.ownerId !== userId) throw new ConvexError("Only the team owner can rotate the invite.");
    const inviteCode = newInvite();
    await ctx.db.patch(team._id, { inviteCode });
    return { inviteCode };
  },
});
