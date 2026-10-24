import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

/** Env Convex Auth needs before GitHub sign-in can work. Values are never read back to clients. */
export const SIGN_IN_ENV = [
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "SITE_URL",
  "JWT_PRIVATE_KEY",
  "JWKS",
] as const;

export const missingSignInEnv = (): string[] => SIGN_IN_ENV.filter((k) => !process.env[k]);

/** Local e2e mode: the shared invite code still joins, and the dashboard reads without sign-in. */
export const openMode = (): boolean => process.env.LB_ALLOW_INVITE === "1";

/** The signed-in user's member row, or null when signed out or removed. */
export async function viewerMember(ctx: QueryCtx): Promise<Doc<"members"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return member && !member.revoked ? member : null;
}

export async function requireMember(ctx: QueryCtx): Promise<Doc<"members">> {
  const member = await viewerMember(ctx);
  if (!member) throw new ConvexError("Sign in first.");
  return member;
}

export async function membership(
  ctx: QueryCtx,
  teamId: Id<"teams">,
  memberId: Id<"members">,
): Promise<Doc<"roomMembers"> | null> {
  return ctx.db
    .query("roomMembers")
    .withIndex("by_member", (q) => q.eq("memberId", memberId).eq("teamId", teamId))
    .first();
}

/** The room, if the signed-in member is in it; open mode lets anyone read. */
export async function viewRoom(
  ctx: QueryCtx,
  teamId: Id<"teams">,
): Promise<{ team: Doc<"teams">; member: Doc<"members"> | null } | null> {
  const team = await ctx.db.get(teamId);
  if (!team) return null;
  const member = await viewerMember(ctx);
  if (openMode()) return { team, member };
  if (!member || !(await membership(ctx, teamId, member._id))) return null;
  return { team, member };
}

export async function requireRoom(
  ctx: QueryCtx,
  teamId: Id<"teams">,
): Promise<{ team: Doc<"teams">; member: Doc<"members"> }> {
  const room = await viewRoom(ctx, teamId);
  if (!room?.member) throw new ConvexError("You're not in this room.");
  return { team: room.team, member: room.member };
}

/** Dashboard reads: the session, if its room is visible to the viewer. */
export async function viewSession(ctx: QueryCtx, sessionId: Id<"sessions">): Promise<Doc<"sessions"> | null> {
  const session = await ctx.db.get(sessionId);
  if (!session) return null;
  return (await viewRoom(ctx, session.teamId)) ? session : null;
}

export async function assertSession(ctx: QueryCtx, sessionId: Id<"sessions">): Promise<Doc<"sessions">> {
  const session = await viewSession(ctx, sessionId);
  if (!session) throw new ConvexError("Session not found, or you're not in its room.");
  return session;
}

/** Decisions on a catch: allowed to anyone who can see the session its node was recorded in. */
export async function assertAgentVisible(ctx: QueryCtx, agentId: Id<"agents"> | undefined): Promise<void> {
  if (openMode()) return;
  const agent = agentId ? await ctx.db.get(agentId) : null;
  if (!agent?.sessionId || !(await viewSession(ctx, agent.sessionId)))
    throw new ConvexError("You're not in this session's room.");
}
