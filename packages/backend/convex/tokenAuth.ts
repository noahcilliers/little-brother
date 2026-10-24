import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { sha256Hex } from "./hash";

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/** Connector tokens come from a laptop's device row, or from a legacy invite-code join on the member. */
export async function memberByTokenHash(ctx: QueryCtx, tokenHash: string): Promise<Doc<"members"> | null> {
  const device = await ctx.db
    .query("deviceTokens")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (device) {
    if (device.status !== "active") return null;
    const owner = await ctx.db.get(device.memberId);
    return owner && !owner.revoked ? owner : null;
  }
  const member = await ctx.db
    .query("members")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  return member && !member.revoked ? member : null;
}

export async function memberByToken(ctx: QueryCtx, token: string): Promise<Doc<"members"> | null> {
  return memberByTokenHash(ctx, await sha256Hex(token));
}
