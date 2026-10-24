import type { BoardCatch, BoardGoal, BoardShared, BoardTask } from "./api";
import { BAR_H, goalLineY, type Layout, laneY } from "./board-layout";

// Everything on the board is drawn as of time t (live: now; paused or replay: the scrubber).

export type BarState = "running" | "done" | "abandoned" | "stopped" | "superseded";
export type CatchKind = BoardCatch["kind"];
// A settled catch fades out over this much compressed time.
const FADE_MS = 3000;

export function isRunning(k: BoardTask, t: number): boolean {
  return k.t1 === null || t < k.t1;
}

export function barEnd(k: BoardTask, t: number): number {
  return k.t1 === null ? t : Math.min(t, k.t1);
}

export function stateAt(k: BoardTask, t: number): BarState {
  if (isRunning(k, t)) return "running";
  if (k.state === "superseded") {
    return k.supersededAt === undefined || t >= k.supersededAt ? "superseded" : "done";
  }
  return k.state === "running" ? "done" : k.state;
}

export const STATE_LABEL: Record<BarState, string> = {
  running: "in progress",
  done: "done",
  abandoned: "abandoned",
  stopped: "stopped",
  superseded: "superseded",
};

export function stateLabel(k: BoardTask, s: BarState): string {
  return s === "stopped" && k.stopKind ? `stopped · ${k.stopKind}` : STATE_LABEL[s];
}

/** Stops for an open conflict are red; duplicates and stale paths amber. */
export function stopColor(k: BoardTask): string {
  return k.stopKind === "conflict" ? "var(--hot)" : "var(--warn)";
}

export type Lookup = {
  tasks: Map<string, BoardTask>;
  /** A plan caught before it had any task is drawn from its goal pill. */
  goals: Map<string, BoardGoal>;
  shared: Map<string, BoardShared>;
  layout: Layout;
  /** Vertical nudge for lessons and decisions whose labels would overlap a neighbour in the band. */
  bandDy: Map<string, number>;
};

const NUDGE = [0, -11, 11];

/** Staggers lessons and decisions that sit too close in time for their labels to fit side by side. */
export function bandOffsets(shared: BoardShared[], layout: Layout): Map<string, number> {
  const out = new Map<string, number>();
  const right = new Map<string, number[]>();
  for (const s of [...shared].sort((a, b) => a.t - b.t)) {
    const row = layout.bandRow.get(s.id);
    if (!row) continue;
    const ends = right.get(row.agentId) ?? NUDGE.map(() => Number.NEGATIVE_INFINITY);
    const x = layout.xAt(s.t);
    const lane = Math.max(
      0,
      ends.findIndex((r) => r < x - 14),
    );
    ends[lane] = x + 18 + s.label.length * 6.6;
    right.set(row.agentId, ends);
    out.set(s.id, NUDGE[lane] ?? 0);
  }
  return out;
}

/** Where a task's bar sits: its lane's top edge. */
export function barTop(k: BoardTask, layout: Layout): number | undefined {
  const row = layout.rows.get(k.agentId);
  return row ? laneY(row, layout.laneOf.get(k.id) ?? 0) - BAR_H / 2 : undefined;
}

/** Where an edge attaches: a bar at the moment in question, or a lesson or decision in its band. */
export function anchor(id: string, t: number, l: Lookup): { x: number; y: number } | undefined {
  const s = l.shared.get(id);
  if (s) {
    const band = l.layout.bandRow.get(s.id)?.band;
    if (band === null || band === undefined) return undefined;
    return { x: l.layout.xAt(s.t), y: band + (l.bandDy.get(s.id) ?? 0) };
  }
  const g = l.goals.get(id);
  if (g) {
    const row = l.layout.rows.get(g.agentId);
    return row ? { x: l.layout.xAt(Math.max(t, g.t0)), y: goalLineY(row) } : undefined;
  }
  const k = l.tasks.get(id);
  const top = k ? barTop(k, l.layout) : undefined;
  if (!k || top === undefined) return undefined;
  const end = k.t1 ?? Math.max(t, k.t0);
  return { x: l.layout.xAt(Math.min(Math.max(t, k.t0), end)), y: top + BAR_H / 2 };
}

export function isOpen(c: BoardCatch, t: number): boolean {
  return t >= c.t && (c.until === null || t < c.until);
}

/**
 * Catch edges show while open and briefly after; afterwards only when one end is selected or their kind is
 * highlighted from the top bar.
 */
export function catchOpacity(
  c: BoardCatch,
  t: number,
  layout: Layout,
  selected: string | null,
  highlight: CatchKind | null,
): number | null {
  if (t < c.t) return null;
  const fade =
    isOpen(c, t) || c.until === null
      ? 1
      : Math.max(0, 1 - (layout.axis.toC(t) - layout.axis.toC(c.until)) / FADE_MS);
  const pinned = selected === c.from || selected === c.to || highlight === c.kind;
  if (fade <= 0 && !pinned) return null;
  return pinned ? Math.max(fade, 0.8) : fade;
}

export function lastBefore<T extends { t: number }>(list: T[], t: number): T | undefined {
  let hit: T | undefined;
  for (const x of list) if (x.t <= t) hit = x;
  return hit;
}
