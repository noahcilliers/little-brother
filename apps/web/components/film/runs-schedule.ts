import type { RunRow } from "./runs-batch";

// Lays a batch's runs onto a fixed number of terminal tiles for the timelapse. Each run keeps its real wall time,
// so long tasks visibly take longer; the batch is then squeezed so its last run ends at progress 1.

export type Placed = { row: RunRow; slot: number; start: number; end: number };

/** Seconds of wall time between tiles picking up their first run, so the grid doesn't start in lockstep. */
const STAGGER_S = 6;

/** Each run goes to the tile that frees up first. start and end are batch progress, 0 to 1. */
export function schedule(rows: readonly RunRow[], slots: number): Placed[] {
  const free = Array.from({ length: slots }, (_, i) => i * STAGGER_S);
  const placed = rows.map((row) => {
    let slot = 0;
    for (let i = 1; i < slots; i++) if ((free[i] ?? 0) < (free[slot] ?? 0)) slot = i;
    const start = free[slot] ?? 0;
    free[slot] = start + row[3];
    return { row, slot, start, end: start + row[3] };
  });
  const span = Math.max(1, ...free);
  return placed.map((p) => ({ ...p, start: p.start / span, end: p.end / span }));
}

/** The run a tile shows at progress u: the one in it now, or the last one it finished. */
export function inSlot(runs: readonly Placed[], slot: number, u: number): Placed | undefined {
  let hit: Placed | undefined;
  for (const r of runs) if (r.slot === slot && r.start <= u) hit = r;
  return hit;
}

export const startedBy = (runs: readonly Placed[], u: number) => runs.filter((r) => r.start <= u).length;

/** Runs finished by u, most recent first. */
export function finishedBy(runs: readonly Placed[], u: number): Placed[] {
  return runs.filter((r) => r.end <= u).sort((a, b) => b.end - a.end);
}
