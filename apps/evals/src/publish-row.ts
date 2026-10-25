import { type EvalRunRow, newTokens } from "@lb/core";
import { z } from "zod";

// One results-dir run record, reduced to what gets published. Parsed loosely: records from older harness
// versions miss fields, and published rows say null rather than guess.

const Expectation = z
  .object({
    outcome: z.string(),
    relation: z.string().optional(),
    row: z.object({ relation: z.string() }).passthrough().optional(),
    detectSec: z.number().optional(),
  })
  .passthrough();

export const PublishedRecord = z
  .object({
    suite: z.string().optional(),
    caseId: z.string(),
    variant: z.string(),
    arm: z.string().optional(),
    run: z.number(),
    score: z
      .object({ expectations: z.array(Expectation), falsePositives: z.array(z.unknown()) })
      .passthrough(),
    costUsd: z.number(),
    tokens: z
      .object({ input: z.number(), output: z.number(), cacheCreation: z.number(), cacheRead: z.number() })
      .optional(),
    wallSec: z.number(),
    catches: z.number().optional(),
    finalSuccess: z.boolean().nullish(),
    mergeConflict: z.boolean().nullish(),
    grade: z
      .object({
        success: z.boolean().nullish(),
        mergeConflict: z.boolean().nullish(),
        interference: z.number().nullish(),
      })
      .passthrough()
      .optional(),
    error: z.string().optional(),
    agents: z.array(z.object({ handle: z.string(), startedAt: z.number() }).passthrough()).optional(),
  })
  .passthrough();
export type PublishedRecord = z.infer<typeof PublishedRecord>;

/** A Claude Code stream with a non-null API error status was rate limited (429) or failed mid-run. */
export const isVoidedStream = (stream: string): boolean => /"api_error_status":\s*\d/.test(stream);

/** Runs recorded before arms existed all had Little Brother on. */
export const armOf = (r: PublishedRecord): string => r.arm ?? "on";

export const runKeyOf = (batch: string, r: PublishedRecord): string =>
  [batch, r.caseId, r.variant, armOf(r), String(r.run)].join("/");

/** `suite` names runs recorded before records carried one (the planted and larger demo-shop suites). */
export type RowMeta = { batch: string; suite: string; model: string; voided: boolean; fallbackAt: number };

export function toRunRow(r: PublishedRecord, meta: RowMeta): EvalRunRow {
  const count = (outcome: string) => r.score.expectations.filter((e) => e.outcome === outcome).length;
  const detect = r.score.expectations.flatMap((e) => (e.detectSec === undefined ? [] : [e.detectSec]));
  const starts = (r.agents ?? []).map((a) => a.startedAt);
  return {
    runKey: runKeyOf(meta.batch, r),
    batch: meta.batch,
    suite: r.suite ?? meta.suite,
    caseId: r.caseId,
    variant: r.variant,
    arm: armOf(r),
    run: r.run,
    model: meta.model,
    costUsd: r.costUsd,
    newTokens: r.tokens ? newTokens(r.tokens) : 0,
    wallSec: r.wallSec,
    finalSuccess: r.finalSuccess ?? r.grade?.success ?? null,
    mergeConflict: r.mergeConflict ?? r.grade?.mergeConflict ?? null,
    interference: r.grade?.interference ?? null,
    catches: r.catches ?? 0,
    hits: count("hit"),
    mislabels: count("mislabel"),
    misses: count("miss"),
    falsePositives: r.score.falsePositives.length,
    detectSec: detect.length ? Math.min(...detect) : null,
    voided: meta.voided || r.error !== undefined,
    at: starts.length ? Math.min(...starts) : meta.fallbackAt,
  };
}

/** The relation the run's first catch was recorded as, for the replay's outcome line. */
export function caughtRelation(r: PublishedRecord): string | null {
  for (const e of r.score.expectations) {
    if (e.outcome !== "hit" && e.outcome !== "mislabel") continue;
    return e.row?.relation ?? e.relation ?? null;
  }
  return null;
}
