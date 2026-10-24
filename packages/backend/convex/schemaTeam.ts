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

  // Rooms (shown as "rooms", stored as teams): who may see each other's sessions. Anyone signed in can
  // create one; others join through its invite link.
  teams: defineTable({
    name: v.string(),
    // Absent only for the room a local open-mode deployment creates for e2e runs, which nobody signs in to.
    ownerId: v.optional(v.id("users")),
    inviteCode: v.string(),
    createdAt: v.number(),
    // "approval" (the default when absent): an invite link or a join code only asks; the owner admits.
    admission: v.optional(v.union(v.literal("approval"), v.literal("open"))),
  }).index("by_invite", ["inviteCode"]),

  // The waiting room: someone opened the invite link, or ran /little-brother:join from Claude Code,
  // without being in the room yet. The owner admits or denies; admitted requests become roomMembers.
  joinRequests: defineTable({
    teamId: v.id("teams"),
    memberId: v.id("members"),
    via: v.union(v.literal("link"), v.literal("claude")),
    sessionId: v.optional(v.id("sessions")),
    status: v.union(v.literal("pending"), v.literal("admitted"), v.literal("denied")),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_team_status", ["teamId", "status", "createdAt"])
    .index("by_member_team", ["memberId", "teamId"]),

  roomMembers: defineTable({
    teamId: v.id("teams"),
    memberId: v.id("members"),
    joinedAt: v.number(),
  })
    .index("by_team", ["teamId", "joinedAt"])
    .index("by_member", ["memberId", "teamId"]),

  // A coordination session inside a room. Claude Code sessions opt in with its code; only sessions
  // that joined are recorded, and the classifier compares work within one session.
  sessions: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    code: v.string(),
    createdBy: v.id("members"),
    createdAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_team", ["teamId", "createdAt"])
    .index("by_code", ["code"]),

  // What the server did for a room, for its host: join attempts, admissions, dropped events, classifier
  // runs and failures. Hook arrivals themselves are read from `events`, not duplicated here.
  serverLog: defineTable({
    teamId: v.id("teams"),
    sessionId: v.optional(v.id("sessions")),
    memberId: v.optional(v.id("members")),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    kind: v.string(),
    text: v.string(),
    at: v.number(),
  })
    .index("by_team", ["teamId", "at"])
    .index("by_session", ["sessionId", "at"])
    .index("by_member", ["memberId", "at"]),

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
