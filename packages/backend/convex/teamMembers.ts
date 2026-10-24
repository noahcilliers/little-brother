import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ensureSeed } from "./seed";

/** GitHub logins are already handle-shaped; anything else is squashed to the same alphabet. */
export function handleFor(user: Doc<"users">): string {
  const raw = user.githubLogin ?? user.name ?? user.email?.split("@")[0] ?? "member";
  const handle = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (handle || "member").slice(0, 40);
}

async function freeHandle(ctx: MutationCtx, base: string, userId: Id<"users">): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const handle = n === 1 ? base : `${base}-${n}`;
    const taken = await ctx.db
      .query("members")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    // A row with no user is a legacy invite-code member of the same name: the GitHub account claims it.
    if (!taken || !taken.userId || taken.userId === userId) return handle;
  }
  throw new ConvexError("Could not pick a free handle.");
}

/** Create or refresh the signed-in user's member row; links a legacy member with the same handle. */
export async function ensureMember(ctx: MutationCtx, userId: Id<"users">): Promise<Doc<"members">> {
  await ensureSeed(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("Signed-in user not found.");
  const name = user.name ?? user.githubLogin ?? "member";
  const fields = { name, avatarUrl: user.image, userId };
  const mine = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (mine) {
    if (mine.revoked) throw new ConvexError("Your access to this team was removed.");
    await ctx.db.patch(mine._id, fields);
    return { ...mine, ...fields };
  }
  const handle = await freeHandle(ctx, handleFor(user), userId);
  const legacy = await ctx.db
    .query("members")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .first();
  if (legacy) {
    await ctx.db.patch(legacy._id, { ...fields, revoked: false });
    return { ...legacy, ...fields, revoked: false };
  }
  const id = await ctx.db.insert("members", { ...fields, handle, revoked: false });
  const created = await ctx.db.get(id);
  if (!created) throw new ConvexError("Member insert failed.");
  return created;
}
