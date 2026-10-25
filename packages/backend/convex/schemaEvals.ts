import { defineTable } from "convex/server";
import { v } from "convex/values";

// Published eval results (apps/evals publish-cli.ts): kept apart from the live coordination tables, and
// shaped by @lb/core's eval-board schemas so the landing reads Convex and its bundled snapshot alike.

const nullableBool = v.union(v.boolean(), v.null());
const nullableNum = v.union(v.number(), v.null());

export const evalRunRow = v.object({
  runKey: v.string(),
  batch: v.string(),
  suite: v.string(),
  caseId: v.string(),
  variant: v.string(),
  arm: v.string(),
  run: v.number(),
  model: v.string(),
  costUsd: v.number(),
  newTokens: v.number(),
  wallSec: v.number(),
  finalSuccess: nullableBool,
  mergeConflict: nullableBool,
  interference: nullableNum,
  catches: v.number(),
  hits: v.number(),
  mislabels: v.number(),
  misses: v.number(),
  falsePositives: v.number(),
  detectSec: nullableNum,
  voided: v.boolean(),
  at: v.number(),
});

const replayEvent = v.object({
  t: v.number(),
  agent: v.string(),
  kind: v.union(
    v.literal("tool"),
    v.literal("edit"),
    v.literal("test"),
    v.literal("catch"),
    v.literal("deny"),
    v.literal("decision"),
  ),
  text: v.string(),
});

export const evalReplay = v.object({
  runKey: v.string(),
  batch: v.string(),
  suite: v.string(),
  caseId: v.string(),
  model: v.string(),
  agents: v.array(v.string()),
  events: v.array(replayEvent),
  outcome: v.object({
    finalSuccess: nullableBool,
    mergeConflict: nullableBool,
    costUsd: v.number(),
    newTokens: v.number(),
    wallSec: v.number(),
    relation: v.union(v.string(), v.null()),
  }),
  contrast: v.union(
    v.object({
      arm: v.string(),
      runs: v.number(),
      mergeConflicts: v.number(),
      successes: v.number(),
      meanCostUsd: v.number(),
      meanNewTokens: v.number(),
    }),
    v.null(),
  ),
});

export const classifierBench = v.object({
  version: v.string(),
  goldPairs: v.number(),
  groups: v.number(),
  openPairs: v.number(),
  settledByModel: v.number(),
  settledShare: v.number(),
  settledAccuracy: v.number(),
  modelMsPerPair: nullableNum,
  judgeMsPerPair: nullableNum,
  relations: v.array(
    v.object({
      relation: v.string(),
      support: v.number(),
      f1: nullableNum,
      settled: v.number(),
      settledPrecision: nullableNum,
    }),
  ),
  at: v.number(),
});

export const evalTables = {
  evalRuns: defineTable(evalRunRow.fields).index("by_key", ["runKey"]).index("by_batch", ["batch"]),

  // Derived from evalRuns on every ingest, so the landing's query reads a handful of rows, not every run.
  evalSummaries: defineTable({
    batch: v.string(),
    suite: v.string(),
    arm: v.string(),
    model: v.string(),
    runs: v.number(),
    voided: v.number(),
    successRate: nullableNum,
    mergeConflictRate: nullableNum,
    interferenceRate: nullableNum,
    meanCostUsd: nullableNum,
    meanNewTokens: nullableNum,
    meanWallSec: nullableNum,
    expected: v.number(),
    caught: v.number(),
  }).index("by_batch", ["batch", "suite", "arm"]),

  evalReplays: defineTable({ ...evalReplay.fields, featured: v.boolean(), at: v.number() })
    .index("by_key", ["runKey"])
    .index("by_featured", ["featured", "at"]),

  classifierBenches: defineTable(classifierBench.fields)
    .index("by_version", ["version"])
    .index("by_at", ["at"]),
};
