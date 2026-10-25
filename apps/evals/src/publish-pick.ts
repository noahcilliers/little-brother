import type { EvalReplay, EvalRunRow, ReplayContrast, ReplayEvent } from "@lb/core";

// Which run the landing replays, and what the same case did without Little Brother.

const sameCase = (a: EvalRunRow, b: EvalRunRow) =>
  a.batch === b.batch && a.suite === b.suite && a.caseId === b.caseId && a.variant === b.variant;

export function contrastFor(rows: EvalRunRow[], on: EvalRunRow): ReplayContrast | null {
  const off = rows.filter((r) => sameCase(r, on) && r.arm === "off" && !r.voided);
  if (!off.length) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    arm: "off",
    runs: off.length,
    mergeConflicts: off.filter((r) => r.mergeConflict === true).length,
    successes: off.filter((r) => r.finalSuccess === true).length,
    meanCostUsd: mean(off.map((r) => r.costUsd)),
    meanNewTokens: mean(off.map((r) => r.newTokens)),
  };
}
/**
 * The best story among Little Brother on runs: a correct catch, a clean merge that passed its checks, and
 * ideally an off-arm twin that hit a merge conflict. Shorter runs replay better, so they win ties.
 */
export function pickReplayRow(rows: EvalRunRow[]): EvalRunRow | null {
  const good = rows.filter(
    (r) => !r.voided && r.arm === "on" && r.hits > 0 && r.finalSuccess === true && r.mergeConflict === false,
  );
  const score = (r: EvalRunRow) => {
    const c = contrastFor(rows, r);
    return c ? c.mergeConflicts / c.runs : 0;
  };
  return [...good].sort((a, b) => score(b) - score(a) || a.wallSec - b.wallSec)[0] ?? null;
}

export function buildReplay(
  row: EvalRunRow,
  rows: EvalRunRow[],
  events: ReplayEvent[],
  relation: string | null,
): EvalReplay {
  return {
    runKey: row.runKey,
    batch: row.batch,
    suite: row.suite,
    caseId: row.caseId,
    model: row.model,
    agents: [...new Set(events.map((e) => e.agent))],
    events,
    outcome: {
      finalSuccess: row.finalSuccess,
      mergeConflict: row.mergeConflict,
      costUsd: row.costUsd,
      newTokens: row.newTokens,
      wallSec: row.wallSec,
      relation,
    },
    contrast: contrastFor(rows, row),
  };
}
