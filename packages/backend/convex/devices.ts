import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireMember, viewerMember } from "./access";
import { randomToken, sha256Hex } from "./hash";

// Connect tokens: one per laptop, shown once, exchanged by `lb join --token` for a long-lived connector
// token. Only hashes are stored.

const CONNECT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEVICES = 20;

export const create = mutation({
  args: { label: v.optional(v.string()) },
  handler: async (ctx, { label }) => {
    const member = await requireMember(ctx);
    const mine = await ctx.db
      .query("deviceTokens")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .take(200);
    const live = mine.filter((d) => d.status !== "revoked");
    if (live.length >= MAX_DEVICES) throw new ConvexError("Revoke an unused laptop before adding another.");
    const token = `lbc_${randomToken()}`;
    const now = Date.now();
    const id = await ctx.db.insert("deviceTokens", {
      memberId: member._id,
      label: label?.trim().slice(0, 60) || `laptop ${mine.length + 1}`,
      status: "pending",
      connectHash: await sha256Hex(token),
      createdAt: now,
      expiresAt: now + CONNECT_TTL_MS,
    });
    return { id, token, handle: member.handle, expiresAt: now + CONNECT_TTL_MS };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const member = await viewerMember(ctx);
    if (!member) return [];
    const rows = await ctx.db
      .query("deviceTokens")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(MAX_DEVICES * 2);
    const now = Date.now();
    return rows
      .filter((d) => d.status !== "revoked" && !(d.status === "pending" && d.expiresAt < now))
      .map((d) => ({
        id: d._id,
        label: d.label,
        status: d.status,
        machine: d.machine ?? null,
        createdAt: d.createdAt,
        joinedAt: d.joinedAt ?? null,
      }));
  },
});

/** Members revoke their own laptops. The connector token stops working at once. */
export const revoke = mutation({
  args: { id: v.id("deviceTokens") },
  handler: async (ctx, { id }) => {
    const member = await requireMember(ctx);
    const device = await ctx.db.get(id);
    if (!device) return null;
    if (device.memberId !== member._id) throw new ConvexError("Not your laptop.");
    await ctx.db.patch(id, { status: "revoked", connectHash: undefined });
    return null;
  },
});

/** /join: swap an unused, unexpired connect token for the connector token. Single use. */
export const redeem = internalMutation({
  args: { connectHash: v.string(), tokenHash: v.string(), machine: v.optional(v.string()) },
  handler: async (ctx, { connectHash, tokenHash, machine }) => {
    const device = await ctx.db
      .query("deviceTokens")
      .withIndex("by_connect", (q) => q.eq("connectHash", connectHash))
      .unique();
    if (device?.status !== "pending" || device.expiresAt < Date.now()) return null;
    const member = await ctx.db.get(device.memberId);
    if (!member || member.revoked) return null;
    await ctx.db.patch(device._id, {
      status: "active",
      connectHash: undefined,
      tokenHash,
      machine: machine?.slice(0, 80),
      joinedAt: Date.now(),
    });
    return { handle: member.handle, name: member.name };
  },
});
