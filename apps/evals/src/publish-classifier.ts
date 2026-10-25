import type { ClassifierBench } from "@lb/core";
import { z } from "zod";

// The pair model's training report (scripts/classifier/results/<version>.json) reduced to what the landing
// compares against the judge. Latencies come from the replay table in a results markdown file, because the
// training report itself doesn't time anything.

const Metrics = z.object({ f1: z.number().nullable(), support: z.number() });
const Settle = z.object({ settled: z.number(), precision: z.number().nullable() });

const Report = z.object({
  version: z.string(),
  goldRows: z.number(),
  groups: z.number(),
  perRelation: z.record(Metrics),
  settle: z.object({
    pairsReachingModel: z.number(),
    settledByModel: z.number(),
    settledShare: z.number(),
    settledAccuracy: z.number(),
  }),
  settleByRelation: z.record(Settle),
});

/** `| pair model only | … | 0.07 ms |` and `| llm every pair | … | 7.0 s |`, as report.py writes them. */
export function replayLatencies(md: string): { modelMs: number | null; judgeMs: number | null } {
  const cell = (row: string): number | null => {
    const m = new RegExp(`^\\|\\s*${row}\\s*\\|.*\\|\\s*([\\d.]+)\\s*(ms|s)\\s*\\|\\s*$`, "m").exec(md);
    if (!m?.[1]) return null;
    const n = Number(m[1]);
    return m[2] === "s" ? n * 1000 : n;
  };
  return { modelMs: cell("pair model only"), judgeMs: cell("llm every pair") };
}

export function classifierBench(report: unknown, latencyMd: string | null, at: number): ClassifierBench {
  const r = Report.parse(report);
  const lat = latencyMd ? replayLatencies(latencyMd) : { modelMs: null, judgeMs: null };
  return {
    version: r.version,
    goldPairs: r.goldRows,
    groups: r.groups,
    openPairs: r.settle.pairsReachingModel,
    settledByModel: r.settle.settledByModel,
    settledShare: r.settle.settledShare,
    settledAccuracy: r.settle.settledAccuracy,
    modelMsPerPair: lat.modelMs,
    judgeMsPerPair: lat.judgeMs,
    relations: Object.entries(r.perRelation).map(([relation, m]) => ({
      relation,
      support: m.support,
      f1: m.f1,
      settled: r.settleByRelation[relation]?.settled ?? 0,
      settledPrecision: r.settleByRelation[relation]?.precision ?? null,
    })),
    at,
  };
}
