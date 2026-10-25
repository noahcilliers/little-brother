import type { EvalRunRow, EvalSummary } from "./eval-board";

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Share of rows where `pick` is true, over the rows that reported it at all. */
function rate(rows: EvalRunRow[], pick: (r: EvalRunRow) => boolean | null): number | null {
  const known = rows.map(pick).filter((b): b is boolean => b !== null);
  return known.length ? known.filter(Boolean).length / known.length : null;
}

/**
 * One summary per batch, suite and arm. Voided runs are counted but never averaged: a rate-limited agent
 * stops early, which would read as a cheap, fast run.
 */
export function summarizeEvalRuns(rows: EvalRunRow[]): EvalSummary[] {
  const groups = new Map<string, EvalRunRow[]>();
  for (const r of rows) {
    const key = JSON.stringify([r.batch, r.suite, r.arm]);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: EvalSummary[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const counted = group.filter((r) => !r.voided);
    const models = [...new Set(counted.map((r) => r.model))];
    out.push({
      batch: first.batch,
      suite: first.suite,
      arm: first.arm,
      model: models.join(", ") || first.model,
      runs: counted.length,
      voided: group.length - counted.length,
      successRate: rate(counted, (r) => r.finalSuccess),
      mergeConflictRate: rate(counted, (r) => r.mergeConflict),
      interferenceRate: rate(counted, (r) => (r.interference === null ? null : r.interference > 0)),
      meanCostUsd: mean(counted.map((r) => r.costUsd)),
      meanNewTokens: mean(counted.map((r) => r.newTokens)),
      meanWallSec: mean(counted.map((r) => r.wallSec)),
      expected: counted.reduce((n, r) => n + r.hits + r.mislabels + r.misses, 0),
      caught: counted.reduce((n, r) => n + r.hits + r.mislabels, 0),
    });
  }
  return out.sort((a, b) =>
    a.batch === b.batch
      ? a.suite === b.suite
        ? a.arm.localeCompare(b.arm)
        : a.suite.localeCompare(b.suite)
      : a.batch.localeCompare(b.batch),
  );
}
