import { newTokens } from "@lb/core";
import type { RunRecord } from "./aggregate";
import { type Arm, armOf } from "./arm";
import { meanSe, type PairedStat, seeded } from "./paired";

/** The pair-run fields multi-arm stats read; planted runs simply leave them out. */
export type AnyRun = RunRecord & {
  kind?: string;
  grade?: { interference: number | null; mergeConflict: boolean; solved: Record<string, boolean> };
};

export type Metric = "success" | "interference" | "conflict" | "solved" | "tokens" | "costUsd" | "wallSec";
export const METRICS: readonly Metric[] = [
  "success",
  "interference",
  "conflict",
  "solved",
  "tokens",
  "costUsd",
  "wallSec",
];

/** One run's value for a metric, or null when the run can't say (no grade, no fix-up, a textual conflict). */
export function value(r: AnyRun, m: Metric): number | null {
  if (m === "success") return r.finalSuccess === undefined ? null : r.finalSuccess ? 1 : 0;
  if (m === "interference") {
    const i = r.grade?.interference;
    return i === null || i === undefined ? null : i > 0 ? 1 : 0;
  }
  if (m === "conflict") return r.mergeConflict === undefined ? null : r.mergeConflict ? 1 : 0;
  if (m === "solved") {
    const s = Object.values(r.grade?.solved ?? {});
    return s.length ? s.filter(Boolean).length / s.length : null;
  }
  if (m === "tokens") return r.tokens ? newTokens(r.tokens) : null;
  return m === "costUsd" ? r.costUsd : r.wallSec;
}

const vals = (runs: AnyRun[], m: Metric) =>
  runs.flatMap((r) => {
    const v = value(r, m);
    return v === null ? [] : [v];
  });

export type ArmStats = { arm: Arm; runs: number; errors: number } & Record<Metric, PairedStat>;

export function armStats(all: AnyRun[], arm: Arm): ArmStats {
  const mine = all.filter((r) => armOf(r) === arm);
  const ok = mine.filter((r) => !r.error);
  const out = { arm, runs: ok.length, errors: mine.length - ok.length } as ArmStats;
  for (const m of METRICS) out[m] = meanSe(vals(ok, m));
  return out;
}

const block = (r: AnyRun) => `${r.suite ?? "planted"}\u0000${r.caseId}\u0000${r.variant}\u0000${r.run}`;

/** Percentile bootstrap of the mean, seeded so a report is reproducible. */
export function bootstrapCi(xs: number[], seed = 1, n = 2000): [number, number] | null {
  if (xs.length < 2) return null;
  const rand = seeded(seed);
  const means: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < xs.length; j++) s += xs[Math.floor(rand() * xs.length)] ?? 0;
    means.push(s / xs.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * n)] ?? 0, means[Math.floor(0.975 * n)] ?? 0];
}

export type Diff = PairedStat & { ci: [number, number] | null };

/** `a − b` over blocks (suite, case, variant, repetition) that have a scored run in both arms. */
export function pairedDiff(all: AnyRun[], a: Arm, b: Arm, m: Metric): Diff {
  const ok = all.filter((r) => !r.error);
  const bs = new Map(ok.filter((r) => armOf(r) === b).map((r) => [block(r), r]));
  const ds = ok
    .filter((r) => armOf(r) === a)
    .flatMap((r) => {
      const o = bs.get(block(r));
      const x = value(r, m);
      const y = o ? value(o, m) : null;
      return x === null || y === null ? [] : [x - y];
    });
  return { ...meanSe(ds), ci: bootstrapCi(ds) };
}
