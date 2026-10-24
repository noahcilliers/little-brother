import { defineTable } from "convex/server";
import { v } from "convex/values";

/** One question (from Claude Code's AskUserQuestion) with its options, as the agent asked it. */
export const askedQuestion = v.object({
  question: v.string(),
  header: v.optional(v.string()),
  multiSelect: v.optional(v.boolean()),
  options: v.array(v.object({ label: v.string(), description: v.optional(v.string()) })),
});

export const askAnswer = v.object({
  question: v.string(),
  selected: v.array(v.string()),
  other: v.optional(v.string()),
});

/**
 * Questions an agent asks its developer, answered on the dashboard instead of in the terminal. Only routed
 * here while that developer has the session open (`presence`), so nobody's agent waits on an unwatched page.
 */
export const askTables = {
  questions: defineTable({
    agentId: v.id("agents"),
    memberId: v.id("members"),
    sessionId: v.id("sessions"),
    toolUseId: v.optional(v.string()),
    questions: v.array(askedQuestion),
    status: v.union(v.literal("pending"), v.literal("answered"), v.literal("expired")),
    answers: v.optional(v.array(askAnswer)),
    at: v.number(),
    answeredAt: v.optional(v.number()),
  })
    .index("by_session_status", ["sessionId", "status", "at"])
    .index("by_member_status", ["memberId", "status", "at"]),

  presence: defineTable({
    memberId: v.id("members"),
    sessionId: v.id("sessions"),
    at: v.number(),
  }).index("by_member_session", ["memberId", "sessionId"]),
};
