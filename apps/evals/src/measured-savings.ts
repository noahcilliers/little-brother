import { newTokens } from "@lb/core";
import type { RunRecord } from "./aggregate";
import { armOf } from "./arm";
import type { Variant } from "./case";

/** One arm of one case and variant: means over its scored runs. */
export type ArmStats = {
  runs: number;
  /** Mean new tokens per run (input + output + cache writes), the definition `tokensSaved` uses. */
  tokens: number | null;
  costUsd: number | null;
  /** Share of planted clashes whose evidence checks passed; null for control cases. */
  clashRate: number | null;
};

export type SavingsRow = {
  caseId: string;
  variant: Variant;
  off: ArmStats;
  on: ArmStats;
  /** off − on mean tokens: what Little Brother saved, measured. Negative means it cost more. */
  measuredTokens: number | null;
  /** Standard error of `measuredTokens`; null with fewer than 2 runs in either arm. */
  measuredSe: number | null;
  measuredUsd: number | null;
  /** Mean of the on runs' catch-based estimate (`classifications.tokensSaved`). */
  estimatedTokens: number | null;
  /** Estimate net of the tokens hooks injected (chars / 4). */
  estimatedNetTokens: number | null;
};

export type SavingsSummary = {
  rows: SavingsRow[];
  /** Sums over rows that have both arms: one pass of those cases and variants. */
  total: Pick<
    SavingsRow,
    "measuredTokens" | "measuredSe" | "measuredUsd" | "estimatedTokens" | "estimatedNetTokens"
  >;
};

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function variance(xs: number[]): number | null {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

const runTokens = (r: RunRecord): number[] => (r.tokens ? [newTokens(r.tokens)] : []);

function armStats(runs: RunRecord[]): ArmStats {
  const exps = runs.flatMap((r) => r.score.expectations);
  return {
    runs: runs.length,
    tokens: mean(runs.flatMap(runTokens)),
    costUsd: mean(runs.map((r) => r.costUsd)),
    clashRate: exps.length ? exps.filter((e) => e.materialized).length / exps.length : null,
  };
}

/** Welch standard error of a difference in means; runs in the two arms are independent, not paired. */
function diffSe(off: number[], on: number[]): number | null {
  const a = variance(off);
  const b = variance(on);
  return a === null || b === null ? null : Math.sqrt(a / off.length + b / on.length);
}

const sub = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : a - b);

function row(caseId: string, variant: Variant, offRuns: RunRecord[], onRuns: RunRecord[]): SavingsRow {
  const off = armStats(offRuns);
  const on = armStats(onRuns);
  const hooked = onRuns.flatMap((r) => (r.hooks ? [r.hooks] : []));
  return {
    caseId,
    variant,
    off,
    on,
    measuredTokens: sub(off.tokens, on.tokens),
    measuredSe: diffSe(offRuns.flatMap(runTokens), onRuns.flatMap(runTokens)),
    measuredUsd: sub(off.costUsd, on.costUsd),
    estimatedTokens: mean(hooked.map((h) => h.tokensSaved)),
    estimatedNetTokens: mean(hooked.map((h) => h.tokensSaved - h.injectedTokens)),
  };
}

const total = (xs: (number | null)[]): number | null => {
  const known = xs.filter((x): x is number => x !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

/**
 * Little Brother off vs on, per case and variant, next to the catch-based estimate. Undefined when no run had
 * Little Brother off. Errored runs and runs without token counts are left out.
 */
export function measuredSavings(runs: RunRecord[]): SavingsSummary | undefined {
  const scored = runs.filter((r) => !r.error && r.tokens);
  if (!scored.some((r) => armOf(r) === "off")) return undefined;
  const keys = [...new Set(scored.map((r) => `${r.caseId}\u0000${r.variant}`))];
  const rows = keys.flatMap((key) => {
    const group = scored.filter((r) => `${r.caseId}\u0000${r.variant}` === key);
    const off = group.filter((r) => armOf(r) === "off");
    const on = group.filter((r) => armOf(r) === "on");
    const first = group[0];
    return first && off.length && on.length ? [row(first.caseId, first.variant, off, on)] : [];
  });
  const ses = rows.map((r) => r.measuredSe);
  return {
    rows,
    total: {
      measuredTokens: total(rows.map((r) => r.measuredTokens)),
      // Independent rows, so variances add; unknown if any row's spread is unknown.
      measuredSe:
        ses.length && ses.every((s) => s !== null)
          ? Math.sqrt(ses.reduce((a, s) => a + (s ?? 0) ** 2, 0))
          : null,
      measuredUsd: total(rows.map((r) => r.measuredUsd)),
      estimatedTokens: total(rows.map((r) => r.estimatedTokens)),
      estimatedNetTokens: total(rows.map((r) => r.estimatedNetTokens)),
    },
  };
}
