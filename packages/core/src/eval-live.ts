import { z } from "zod";
import { EvalReplay, EvalRunRow, type EvalSummary } from "./eval-board";

// Live eval streaming: the harness posts a batch's plan, then each run as soon as it is graded, and the
// public /benchmarks page folds those into progress and per-arm tables. Aggregates only, like eval-board.

export const EvalBatchConfig = z.object({
  /** Same label the after-the-fact publisher derives from the results dir, so both paths share rows. */
  batch: z.string().min(1).max(200),
  suite: z.string().min(1).max(80),
  model: z.string().max(120),
  arms: z.array(z.string().min(1).max(40)).max(8),
  planned: z.number().int().nonnegative(),
  startedAt: z.number(),
  /** Null while the harness is still running it. */
  finishedAt: z.number().nullable(),
  /** Jobs the cost cap stopped before they started. */
  skipped: z.number().int().nonnegative(),
});
export type EvalBatchConfig = z.infer<typeof EvalBatchConfig>;

export const EvalRunPost = z
  .object({ batch: z.string().min(1), row: EvalRunRow, replay: EvalReplay.nullable().default(null) })
  .refine((p) => p.row.batch === p.batch, { message: "row.batch must match batch" })
  .refine((p) => p.replay === null || p.replay.runKey === p.row.runKey, {
    message: "replay.runKey must match row.runKey",
  });
export type EvalRunPost = z.infer<typeof EvalRunPost>;

export type BatchStatus = "running" | "finished" | "published";

export type BenchBatch = {
  batch: string;
  suite: string;
  model: string;
  arms: string[];
  status: BatchStatus;
  /** Runs graded so far, voided included: what the progress bar fills with. */
  graded: number;
  voided: number;
  planned: number;
  skipped: number;
  startedAt: number | null;
  finishedAt: number | null;
  perArm: EvalSummary[];
};

/** One feed line: a graded run's outcome, without its prompts or agent transcripts. */
export type BenchRun = Pick<
  EvalRunRow,
  | "runKey"
  | "batch"
  | "suite"
  | "caseId"
  | "arm"
  | "run"
  | "model"
  | "finalSuccess"
  | "mergeConflict"
  | "interference"
  | "hits"
  | "misses"
  | "catches"
  | "costUsd"
  | "newTokens"
  | "wallSec"
  | "voided"
> & { landedAt: number };

export type BenchmarkBoard = { batches: BenchBatch[]; feed: BenchRun[] };

export function benchRun(r: EvalRunRow, landedAt: number): BenchRun {
  const { runKey, batch, suite, caseId, arm, run, model, finalSuccess, mergeConflict, interference } = r;
  const { hits, misses, catches, costUsd, newTokens, wallSec, voided } = r;
  return {
    runKey,
    batch,
    suite,
    caseId,
    arm,
    run,
    model,
    finalSuccess,
    mergeConflict,
    interference,
    hits,
    misses,
    catches,
    costUsd,
    newTokens,
    wallSec,
    voided,
    landedAt,
  };
}

/** Published batches carry no clock; their results folder is named for the run date (haiku-1025 = Oct 25). */
function runDate(batch: string): number {
  const m = /(\d{4})/.exec(batch.split("/")[0] ?? "");
  return m?.[1] ? Number(m[1]) : 0;
}

/**
 * Every batch the board knows of, newest first: those the harness announced (with a plan and a clock) and
 * those only published after the fact (their summaries are all there is, so planned equals graded).
 */
export function benchmarkBatches(
  configs: EvalBatchConfig[],
  summaries: EvalSummary[],
  limit = 30,
): BenchBatch[] {
  const byBatch = new Map<string, EvalSummary[]>();
  for (const s of summaries) byBatch.set(s.batch, [...(byBatch.get(s.batch) ?? []), s]);
  const labels = new Set([...configs.map((c) => c.batch), ...byBatch.keys()]);
  const out = [...labels].map((batch): BenchBatch => {
    const perArm = byBatch.get(batch) ?? [];
    const config = configs.find((c) => c.batch === batch);
    const graded = perArm.reduce((n, s) => n + s.runs + s.voided, 0);
    const voided = perArm.reduce((n, s) => n + s.voided, 0);
    return {
      batch,
      suite: config?.suite ?? [...new Set(perArm.map((s) => s.suite))].join(", "),
      model: config?.model ?? [...new Set(perArm.map((s) => s.model))].join(", "),
      arms: config?.arms ?? perArm.map((s) => s.arm),
      status: !config ? "published" : config.finishedAt === null ? "running" : "finished",
      graded,
      voided,
      // A rerun into the same results dir can grade more runs than this invocation planned.
      planned: Math.max(config?.planned ?? graded, graded),
      skipped: config?.skipped ?? 0,
      startedAt: config?.startedAt ?? null,
      finishedAt: config?.finishedAt ?? null,
      perArm,
    };
  });
  return out
    .sort((a, b) =>
      a.startedAt !== null && b.startedAt !== null
        ? b.startedAt - a.startedAt
        : a.startedAt !== null
          ? -1
          : b.startedAt !== null
            ? 1
            : runDate(b.batch) - runDate(a.batch) || b.batch.localeCompare(a.batch),
    )
    .slice(0, limit);
}
