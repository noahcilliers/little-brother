import { newTokens } from "@lb/core";
import type { RunRecord } from "./aggregate";
import { metrics } from "./aggregate";
import { armOf } from "./arm";
import { latencyMetrics } from "./latency";
import { meanSe, pairedSummary } from "./paired";

// The measured numbers for apps/web/components/film/benchmarks.ts, in its own `Benchmark` shape, so the
// site's targets and placeholders can be swapped for an eval's results without retyping them.

type Status = "measured" | "target" | "placeholder";
type Point = { name: string; value: number };
export type SiteBenchmark = {
  label: string;
  value: number;
  unit: string;
  status: Status;
  bound?: string;
  baselines?: Point[];
  baselineStatus?: Status;
  parts?: Point[];
  /** Not read by the site: sample sizes and spread, so nobody quotes a number without them. */
  n: Record<string, number | null>;
};

const round = (x: number, digits = 0) => Math.round(x * 10 ** digits) / 10 ** digits;

/** Change from off to on as a signed percent of off: negative means on used less. */
function pctChange(off: number, on: number): number {
  return off === 0 ? 0 : ((on - off) / off) * 100;
}

const boundOf = (pct: number) => (pct < 0 ? "−" : "+");

export function siteBenchmarks(runs: RunRecord[], spawnOverheadMs: number) {
  const scored = runs.filter((r) => !r.error);
  const on = scored.filter((r) => armOf(r) === "on");
  const off = scored.filter((r) => armOf(r) === "off");
  const m = metrics(on);
  const caught = m.hits + m.mislabels;
  const lat = latencyMetrics(
    on.flatMap((r) => (r.hooks ? [r.hooks] : [])),
    spawnOverheadMs,
  );
  const tokOn = meanSe(on.flatMap((r) => (r.tokens ? [newTokens(r.tokens)] : [])));
  const tokOff = meanSe(off.flatMap((r) => (r.tokens ? [newTokens(r.tokens)] : [])));
  const usdOn = meanSe(on.map((r) => r.costUsd));
  const usdOff = meanSe(off.map((r) => r.costUsd));
  const paired = pairedSummary(scored);
  const tokPct = pctChange(tokOff.mean ?? 0, tokOn.mean ?? 0);
  const usdPct = pctChange(usdOff.mean ?? 0, usdOn.mean ?? 0);
  const estimates = on.flatMap((r) => (r.hooks && r.catches ? [r.hooks.tokensSaved / r.catches] : []));
  const perCatch = meanSe(estimates);
  const beforeEdit = Math.round((m.beforeEditRate ?? 0) * caught);
  const benchmarks: Record<string, SiteBenchmark> = {
    precision: {
      label: "Precision on blocking verdicts · planted suite",
      value: round((m.precision ?? 0) * 100),
      unit: "%",
      bound: "",
      status: "measured",
      n: { caught, falsePositives: m.falsePositives, controlRuns: m.controlRuns, runs: on.length },
    },
    catches: {
      label: "Clashes caught before the first edit",
      value: beforeEdit,
      unit: `/ ${caught + m.misses}`,
      status: "measured",
      n: { caught, misses: m.misses, beforeFirstEdit: beforeEdit },
    },
    latency: {
      label: "PreToolUse p95 · live eval agents",
      value: round(lat.p95Ms ?? 0),
      unit: "ms",
      bound: "",
      status: "measured",
      parts: lat.phaseMsPerCall.map(([name, v]) => ({ name, value: round(v, 1) })),
      n: { calls: lat.preToolUseCalls, p50Ms: lat.p50Ms, maxMs: lat.maxMs, spawnOverheadMs },
    },
    tokensControlled: {
      label: "Tokens per run · off vs on",
      value: round(Math.abs(tokPct)),
      unit: "%",
      bound: boundOf(tokPct),
      status: "measured",
      baselines: [
        { name: "off", value: 100 },
        { name: "on", value: round(100 + tokPct) },
      ],
      baselineStatus: "measured",
      n: {
        offRuns: tokOff.n,
        onRuns: tokOn.n,
        offMean: tokOff.mean,
        onMean: tokOn.mean,
        pairs: paired.pairs,
        pairedSavedMean: paired.tokens.mean,
        pairedSavedSe: paired.tokens.se,
      },
    },
    tokensReplay: {
      label: "Saved by catches · estimate per catch",
      value: round((perCatch.mean ?? 0) / 1000, 1),
      unit: "k tokens",
      bound: "≈",
      status: "measured",
      n: { runs: perCatch.n, se: perCatch.se },
    },
    cost: {
      label: "$ per run · off vs on",
      value: round(Math.abs(usdPct)),
      unit: "%",
      bound: boundOf(usdPct),
      status: "measured",
      baselines: [
        { name: "off", value: round(usdOff.mean ?? 0, 3) },
        { name: "on", value: round(usdOn.mean ?? 0, 3) },
      ],
      baselineStatus: "measured",
      n: { pairs: paired.pairs, pairedSavedMean: paired.costUsd.mean, pairedSavedSe: paired.costUsd.se },
    },
  };
  return benchmarks;
}
