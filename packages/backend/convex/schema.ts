import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { askTables } from "./schemaAsk";
import { evalTables } from "./schemaEvals";
import { graphTables, importerLink } from "./schemaGraph";
import { members, teamTables } from "./schemaTeam";

export const typeKey = v.union(
  v.literal("conflict"),
  v.literal("stale"),
  v.literal("duplicate"),
  v.literal("normal"),
);
export const action = v.union(
  v.literal("ignore"),
  v.literal("warn"),
  v.literal("serialize"),
  v.literal("block"),
);
export const touch = v.object({
  path: v.string(),
  symbol: v.optional(v.string()),
  op: v.string(),
  lines: v.optional(v.array(v.number())),
  newPath: v.optional(v.string()),
  generated: v.optional(v.boolean()),
});

export default defineSchema({
  ...teamTables,
  ...graphTables,
  ...askTables,
  ...evalTables,
  members,

  agents: defineTable({
    memberId: v.id("members"),
    claudeSessionId: v.string(),
    teamId: v.optional(v.id("teams")),
    sessionId: v.optional(v.id("sessions")),
    machine: v.string(),
    // Working folder, to notice two Claude sessions sharing one checkout on one machine.
    cwd: v.optional(v.string()),
    repo: v.string(),
    branch: v.string(),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("offline")),
    intentId: v.optional(v.id("nodes")),
    lastSeenAt: v.number(),
    baseRev: v.optional(v.string()),
    git: v.optional(
      v.object({
        op: v.string(),
        ok: v.boolean(),
        sha: v.optional(v.string()),
        target: v.optional(v.string()),
        at: v.number(),
      }),
    ),
  })
    .index("by_session", ["claudeSessionId"])
    .index("by_status", ["status"])
    .index("by_member", ["memberId", "lastSeenAt"])
    .index("by_lb_session", ["sessionId", "lastSeenAt"]),

  events: defineTable({
    agentId: v.id("agents"),
    eventKey: v.string(),
    source: v.union(v.literal("hook"), v.literal("mcp"), v.literal("verify"), v.literal("human")),
    hook: v.string(),
    tool: v.optional(v.string()),
    files: v.array(v.string()),
    summary: v.string(),
    payload: v.any(),
    nodeId: v.optional(v.id("nodes")),
    tokens: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_key", ["eventKey"])
    .index("by_agent_time", ["agentId", "at"])
    .index("by_time", ["at"]),

  nodes: defineTable({
    agentId: v.id("agents"),
    teamId: v.optional(v.id("teams")), // the author agent's room, so hot-path reads stay inside it
    kind: v.union(v.literal("knowledge"), v.literal("intent"), v.literal("action")),
    verb: v.string(),
    text: v.string(), // compact signature; what gets embedded
    topic: v.optional(v.string()),
    files: v.array(v.string()),
    touches: v.array(touch),
    references: v.array(v.string()),
    parentId: v.optional(v.id("nodes")),
    outcome: v.union(v.literal("open"), v.literal("succeeded"), v.literal("failed"), v.literal("superseded")),
    signature: v.optional(v.string()),
    toolUseId: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")), // the agent's own plan step this action belongs to
    label: v.optional(v.string()), // short behavior label: verb + primary symbol, e.g. "edit issueToken()"
    tokens: v.optional(v.number()), // actions: tokens the tool call cost (from the transcript); intents: rollup of their actions
    preview: v.optional(v.string()),
    consumes: v.optional(v.array(v.string())),
    importers: v.optional(v.array(importerLink)), // repo graph: who imports what this node's interface change breaks
    baseRev: v.optional(v.string()),
    landed: v.optional(v.union(v.literal("committed"), v.literal("pushed"), v.literal("merged"))),
    embedding: v.optional(v.array(v.float64())),
    at: v.number(),
  })
    .index("by_agent", ["agentId", "at"])
    .index("by_topic", ["topic"])
    .index("by_signature", ["signature"])
    .index("by_tool_use", ["toolUseId"])
    .index("by_outcome", ["outcome", "at"])
    .index("by_agent_outcome", ["agentId", "outcome", "at"])
    .index("by_team_outcome", ["teamId", "outcome", "at"])
    .index("by_team_kind", ["teamId", "kind", "at"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["kind", "outcome"],
    }),

  // The agent's own plan steps (Claude Code task list), or inferred groups when it keeps none.
  tasks: defineTable({
    agentId: v.id("agents"),
    taskKey: v.string(), // Claude Code task_id, or "inferred:<n>"
    subject: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("stopped"),
      v.literal("abandoned"),
      v.literal("superseded"),
    ),
    goalId: v.optional(v.id("nodes")), // the intent (prompt) it serves
    source: v.union(v.literal("task_tool"), v.literal("inferred")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    note: v.optional(v.string()), // why it stopped / was superseded, or the closing summary
    tokens: v.optional(v.number()), // rollup of its actions' tokens
  })
    .index("by_agent", ["agentId", "startedAt"])
    .index("by_key", ["agentId", "taskKey"]),

  verbs: defineTable({
    key: v.string(),
    description: v.string(),
    match: v.array(
      v.object({
        tool: v.optional(v.string()),
        input: v.optional(v.string()),
        after: v.optional(v.string()),
        outcome: v.optional(v.string()),
      }),
    ),
    priority: v.number(),
    status: v.union(v.literal("active"), v.literal("proposed")),
  }).index("by_key", ["key"]),

  eventTypes: defineTable({
    key: typeKey,
    enforcement: v.union(v.literal("block"), v.literal("warn"), v.literal("silent")),
    description: v.string(),
  }).index("by_key", ["key"]),

  classifications: defineTable({
    eventId: v.optional(v.id("events")),
    nodeId: v.id("nodes"),
    type: typeKey,
    relation: v.string(),
    direction: v.union(v.literal("new_needs_other"), v.literal("other_needs_new"), v.literal("none")),
    action,
    againstNodeId: v.optional(v.id("nodes")),
    agentIds: v.array(v.id("agents")),
    teamId: v.optional(v.id("teams")), // the new node's room, so the PreToolUse gates scan only their room
    reason: v.string(),
    evidence: v.array(v.string()),
    confidence: v.number(),
    retrievalScore: v.number(),
    source: v.union(v.literal("rule"), v.literal("pair_model"), v.literal("llm"), v.literal("fallback")),
    status: v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed")),
    resolution: v.optional(v.string()),
    // Who settled it and when, for the board: "ash on the dashboard", "@noah (owner)", "noah's push".
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    feedback: v.optional(v.union(v.literal("confirmed"), v.literal("false_positive"), v.literal("ignored"))),
    outcome: v.optional(v.string()),
    winnerAgentId: v.optional(v.id("agents")), // collisions: whose claim held under the priority policy
    comparison: v.optional(v.string()), // escalations: LLM side-by-side once both sides have code
    tokensSaved: v.optional(v.number()), // estimate: tokens the catch spared (see convex/savings.ts)
    gitStatus: v.optional(v.union(v.literal("confirmed"), v.literal("clean"), v.literal("missed"))),
    latencyMs: v.number(),
    // One coordination event between two goals, however many steps re-trigger it (core catchKey).
    catchKey: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_catch", ["catchKey", "at"])
    .index("by_node", ["nodeId"])
    .index("by_status", ["status", "at"])
    .index("by_team_status", ["teamId", "status", "at"])
    .index("by_pair", ["nodeId", "againstNodeId"])
    .index("by_against", ["againstNodeId"]),

  inbox: defineTable({
    agentId: v.id("agents"),
    classificationId: v.id("classifications"),
    text: v.string(),
    action: v.union(v.literal("warn"), v.literal("serialize"), v.literal("block")),
    state: v.union(v.literal("queued"), v.literal("delivered"), v.literal("acked"), v.literal("applied")),
    attempts: v.number(),
    at: v.number(),
  })
    .index("by_agent_state", ["agentId", "state"])
    .index("by_classification", ["classificationId"]),

  settings: defineTable({ key: v.string(), value: v.any() }).index("by_key", ["key"]),
});
