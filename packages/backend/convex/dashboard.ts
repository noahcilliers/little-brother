import { v } from "convex/values";
import { query } from "./_generated/server";
import { activity as activityRows, eventTypeCounts as typeCounts } from "./dashboardQueries/activity";
import { agents as agentRows, agentStream as streamFor } from "./dashboardQueries/agents";
import { openConflicts as conflicts } from "./dashboardQueries/conflicts";
import { nodeDetail as detail, graph as graphView } from "./dashboardQueries/graph";
import { metrics as metricView } from "./dashboardQueries/metrics";

// Read models for apps/web. Public and unauthenticated for the hackathon; every read is bounded.
// Handlers live in dashboardQueries/ so each stays small; this file only fixes the public API names.

export const graph = query({ args: {}, handler: (ctx) => graphView(ctx) });

export const nodeDetail = query({
  args: { nodeId: v.id("nodes") },
  handler: (ctx, { nodeId }) => detail(ctx, nodeId),
});

export const activity = query({
  args: { limit: v.optional(v.number()) },
  handler: (ctx, { limit }) => activityRows(ctx, limit),
});

export const eventTypeCounts = query({ args: {}, handler: (ctx) => typeCounts(ctx) });

export const agents = query({ args: {}, handler: (ctx) => agentRows(ctx) });

export const agentStream = query({
  args: { agentId: v.id("agents") },
  handler: (ctx, { agentId }) => streamFor(ctx, agentId),
});

export const openConflicts = query({ args: {}, handler: (ctx) => conflicts(ctx) });

export const metrics = query({ args: {}, handler: (ctx) => metricView(ctx) });
