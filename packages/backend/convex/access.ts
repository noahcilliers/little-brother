import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
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

export async function theTeam(ctx: QueryCtx): Promise<Doc<"teams"> | null> {
  return ctx.db.query("teams").first();
}

/** The signed-in user's member row, or null when signed out, not on the team, or removed. */
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
  if (!member) throw new ConvexError("Sign in as a team member first.");
  return member;
}

/** Dashboard reads and decisions: team members only, except in local open mode. */
export async function assertViewer(ctx: QueryCtx): Promise<void> {
  if (openMode()) return;
  await requireMember(ctx);
}
