import { newTokens } from "@lb/core";
import { metrics, type RunRecord } from "./aggregate";
import { type Arm, armOf } from "./arm";
import { meanSe, type PairedStat, type PairedSummary, pairedSummary } from "./paired";

/** One arm's per-run means (± one standard error), plus outcome rates. */
export type ArmSummary = {
  runs: number;
  errors: number;
  tokens: PairedStat;
  cacheRead: PairedStat;
  costUsd: PairedStat;
  wallSec: PairedStat;
  /** Share of runs whose integrated tree passed; null without a fix-up step. */
  finalSuccess: number | null;
  finalSuccessN: number;
  /** Share of planted clashes whose evidence checks passed. */
  clashRate: number | null;
  mergeConflictRate: number | null;
  /** Detection, Little Brother on only. */
  recall: number | null;
  precision: number | null;
  beforeEditRate: number | null;
  medianDetectSec: number | null;
  catchesPerRun: number | null;
};

const rate = (xs: boolean[]): number | null => (xs.length ? xs.filter(Boolean).length / xs.length : null);

export function armSummary(all: RunRecord[], arm: Arm): ArmSummary {
  const mine = all.filter((r) => armOf(r) === arm);
  const runs = mine.filter((r) => !r.error);
  const finals = runs.flatMap((r) => (r.finalSuccess === undefined ? [] : [r.finalSuccess]));
  const m = arm === "on" ? metrics(runs) : null;
  const catches = runs.flatMap((r) => (r.catches === undefined ? [] : [r.catches]));
  return {
    runs: runs.length,
    errors: mine.length - runs.length,
    tokens: meanSe(runs.flatMap((r) => (r.tokens ? [newTokens(r.tokens)] : []))),
    cacheRead: meanSe(runs.flatMap((r) => (r.tokens ? [r.tokens.cacheRead] : []))),
    costUsd: meanSe(runs.map((r) => r.costUsd)),
    wallSec: meanSe(runs.map((r) => r.wallSec)),
    finalSuccess: rate(finals),
    finalSuccessN: finals.length,
    clashRate: rate(runs.flatMap((r) => r.score.expectations.map((e) => e.materialized))),
    mergeConflictRate: rate(runs.flatMap((r) => (r.mergeConflict === undefined ? [] : [r.mergeConflict]))),
    recall: m?.recall ?? null,
    precision: m?.precision ?? null,
    beforeEditRate: m?.beforeEditRate ?? null,
    medianDetectSec: m?.medianDetectSec ?? null,
    catchesPerRun: catches.length ? catches.reduce((a, b) => a + b, 0) / catches.length : null,
  };
}

export type ArmComparison = { off: ArmSummary; on: ArmSummary; paired: PairedSummary };

export const compareArms = (runs: RunRecord[]): ArmComparison => ({
  off: armSummary(runs, "off"),
  on: armSummary(runs, "on"),
  paired: pairedSummary(runs),
});
