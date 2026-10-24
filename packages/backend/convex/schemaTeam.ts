import { authTables } from "@convex-dev/auth/server";
import { defineTable } from "convex/server";
import { v } from "convex/values";

// Identity and team tables, kept apart from the coordination graph in schema.ts.

/** Convex Auth's `users` table plus the GitHub login, which becomes the member handle. */
const users = defineTable({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  githubLogin: v.optional(v.string()),
})
  .index("email", ["email"])
  .index("phone", ["phone"]);

export const members = defineTable({
  name: v.string(),
  handle: v.string(),
  // Legacy invite-code joins keep one connector token on the member; GitHub members use deviceTokens.
  tokenHash: v.optional(v.string()),
  revoked: v.boolean(),
  userId: v.optional(v.id("users")),
  avatarUrl: v.optional(v.string()),
})
  .index("by_token", ["tokenHash"])
  .index("by_handle", ["handle"])
  .index("by_user", ["userId"]);

export const teamTables = {
  ...authTables,
  users,

  // One team per deployment: the first signed-in user creates it and owns the invite code.
  teams: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    inviteCode: v.string(),
    createdAt: v.number(),
  }).index("by_invite", ["inviteCode"]),

  // One row per laptop. The connect token is single-use and exchanged at /join for the connector token.
  deviceTokens: defineTable({
    memberId: v.id("members"),
    label: v.string(),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("revoked")),
    connectHash: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    machine: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_connect", ["connectHash"])
    .index("by_token", ["tokenHash"])
    .index("by_member", ["memberId", "createdAt"]),
};
