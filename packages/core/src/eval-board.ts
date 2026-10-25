import { z } from "zod";

// Published eval results: what apps/evals pushes to Convex and what the landing reads back. Only aggregate,
// non-sensitive fields: no prompts, no tokens or keys, no member emails.

export const REPLAY_KINDS = ["tool", "edit", "test", "catch", "deny", "decision"] as const;
export type ReplayKind = (typeof REPLAY_KINDS)[number];

/** Longest replay line; long enough for a deny reason's headline, short enough for one terminal row. */
export const REPLAY_TEXT_MAX = 160;

export const ReplayEvent = z.object({
  /** Milliseconds since the run's first timestamped line. */
  t: z.number().int().nonnegative(),
  agent: z.string(),
  kind: z.enum(REPLAY_KINDS),
  text: z.string().max(REPLAY_TEXT_MAX),
});
export type ReplayEvent = z.infer<typeof ReplayEvent>;

const nullableBool = z.boolean().nullable();

export const EvalRunRow = z.object({
  /** `<batch>/<caseId>/<variant>/<arm>/<run>`: re-publishing the same results dir is a no-op. */
  runKey: z.string(),
  batch: z.string(),
  suite: z.string(),
  caseId: z.string(),
  variant: z.string(),
  arm: z.string(),
  run: z.number().int(),
  model: z.string(),
  costUsd: z.number(),
  newTokens: z.number(),
  wallSec: z.number(),
  finalSuccess: nullableBool,
  mergeConflict: nullableBool,
  interference: z.number().nullable(),
  catches: z.number(),
  hits: z.number(),
  mislabels: z.number(),
  misses: z.number(),
  falsePositives: z.number(),
  /** Seconds from the clash to its first catch, when one was caught. */
  detectSec: z.number().nullable(),
  /** A rate-limited agent stream or a harness error: stored for the record, left out of every summary. */
  voided: z.boolean(),
  at: z.number(),
});
export type EvalRunRow = z.infer<typeof EvalRunRow>;

export const EvalSummary = z.object({
  batch: z.string(),
  suite: z.string(),
  arm: z.string(),
  model: z.string(),
  runs: z.number(),
  voided: z.number(),
  /** Shares in [0, 1]; null when no counted run reported the field. */
  successRate: z.number().nullable(),
  mergeConflictRate: z.number().nullable(),
  interferenceRate: z.number().nullable(),
  meanCostUsd: z.number().nullable(),
  meanNewTokens: z.number().nullable(),
  meanWallSec: z.number().nullable(),
  expected: z.number(),
  caught: z.number(),
});
export type EvalSummary = z.infer<typeof EvalSummary>;

export const ReplayOutcome = z.object({
  finalSuccess: nullableBool,
  mergeConflict: nullableBool,
  costUsd: z.number(),
  newTokens: z.number(),
  wallSec: z.number(),
  relation: z.string().nullable(),
});

/** The same case with Little Brother off, from the same batch: what the replayed catch spared. */
export const ReplayContrast = z.object({
  arm: z.string(),
  runs: z.number(),
  mergeConflicts: z.number(),
  successes: z.number(),
  meanCostUsd: z.number(),
  meanNewTokens: z.number(),
});
export type ReplayContrast = z.infer<typeof ReplayContrast>;

export const EvalReplay = z.object({
  runKey: z.string(),
  batch: z.string(),
  suite: z.string(),
  caseId: z.string(),
  model: z.string(),
  agents: z.array(z.string()),
  events: z.array(ReplayEvent),
  outcome: ReplayOutcome,
  contrast: ReplayContrast.nullable(),
});
export type EvalReplay = z.infer<typeof EvalReplay>;

export const RelationBench = z.object({
  relation: z.string(),
  support: z.number(),
  f1: z.number().nullable(),
  /** Open pairs of this relation the pair model settled without the judge, and how many it got right. */
  settled: z.number(),
  settledPrecision: z.number().nullable(),
});

export const ClassifierBench = z.object({
  version: z.string(),
  goldPairs: z.number(),
  groups: z.number(),
  /** Pairs no tier-0 rule settles: the ones that would otherwise each cost a judge call. */
  openPairs: z.number(),
  settledByModel: z.number(),
  settledShare: z.number(),
  settledAccuracy: z.number(),
  modelMsPerPair: z.number().nullable(),
  judgeMsPerPair: z.number().nullable(),
  relations: z.array(RelationBench),
  at: z.number(),
});
export type ClassifierBench = z.infer<typeof ClassifierBench>;

/** Everything the landing's eval section shows, from Convex or from the bundled snapshot. */
export const LandingEvals = z.object({
  summaries: z.array(EvalSummary),
  replay: EvalReplay.nullable(),
  classifier: ClassifierBench.nullable(),
});
export type LandingEvals = z.infer<typeof LandingEvals>;
