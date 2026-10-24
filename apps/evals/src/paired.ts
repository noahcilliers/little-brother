import { newTokens } from "@lb/core";
import type { RunRecord } from "./aggregate";
import { armOf } from "./arm";

/** Deterministic PRNG (mulberry32): the same seed gives every invocation the same schedule. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Paired scheduling: a block's off and on runs are adjacent in the queue, so with concurrency ≥ 2 they run
 * side by side under the same load and backend state; which arm goes first, and the block order, come
 * from the seed. Without pairing, all of one arm could run before the other and absorb any drift.
 */
export function pairedSchedule<T extends { arm: "on" | "off" }>(blocks: T[][], seed: number): T[] {
  const rand = seeded(seed);
  return shuffle(blocks, rand).flatMap((b) => (rand() < 0.5 ? b : [...b].reverse()));
}

export type PairedStat = { n: number; mean: number | null; se: number | null };

export function meanSe(xs: number[]): PairedStat {
  if (!xs.length) return { n: 0, mean: null, se: null };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (xs.length < 2) return { n: xs.length, mean, se: null };
  const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  return { n: xs.length, mean, se: Math.sqrt(v / xs.length) };
}

const blockKey = (r: RunRecord) => `${r.suite ?? "planted"}\u0000${r.caseId}\u0000${r.variant}\u0000${r.run}`;

/** Off and on runs that share suite, case, variant and repetition: the unit of a paired comparison. */
export function pairs(runs: RunRecord[]): [RunRecord, RunRecord][] {
  const ok = runs.filter((r) => !r.error);
  const off = new Map(ok.filter((r) => armOf(r) === "off").map((r) => [blockKey(r), r]));
  return ok.flatMap((on): [RunRecord, RunRecord][] => {
    const o = armOf(on) === "on" ? off.get(blockKey(on)) : undefined;
    return o ? [[o, on]] : [];
  });
}

export type PairedSummary = {
  pairs: number;
  /** off − on; positive means Little Brother saved. */
  tokens: PairedStat;
  cacheRead: PairedStat;
  costUsd: PairedStat;
  wallSec: PairedStat;
  /** on − off in final success (1/0); positive means Little Brother helped. */
  success: PairedStat;
};

const succ = (r: RunRecord) => (r.finalSuccess === undefined ? null : r.finalSuccess ? 1 : 0);

/** Paired differences with one standard error (of the mean difference). */
export function pairedSummary(runs: RunRecord[]): PairedSummary {
  const ps = pairs(runs);
  const diff = (f: (r: RunRecord) => number | null, sign = 1) =>
    meanSe(
      ps.flatMap(([off, on]) => {
        const a = f(off);
        const b = f(on);
        return a === null || b === null ? [] : [sign * (a - b)];
      }),
    );
  return {
    pairs: ps.length,
    tokens: diff((r) => (r.tokens ? newTokens(r.tokens) : null)),
    cacheRead: diff((r) => r.tokens?.cacheRead ?? null),
    costUsd: diff((r) => r.costUsd),
    wallSec: diff((r) => r.wallSec),
    success: diff(succ, -1),
  };
}
