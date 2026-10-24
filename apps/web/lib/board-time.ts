import type { BoardCatch, BoardShared, BoardTask } from "./api";
import type { Layout } from "./board-layout";

// Everything on the board is drawn as of time t (live: now; paused or replay: the scrubber).

export type BarState = "running" | "done" | "abandoned" | "stopped" | "superseded";
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
  if (k.state === "superseded")
    return k.supersededAt === undefined || t >= k.supersededAt ? "superseded" : "done";
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
  shared: Map<string, BoardShared>;
  layout: Layout;
  /** Vertical nudge for lessons and decisions whose labels would overlap a neighbour in the band. */
  bandDy: Map<string, number>;
};

const LANES = [0, 22, -22];

/** Staggers lessons and decisions that sit too close in time for their labels to fit side by side. */
export function bandOffsets(shared: BoardShared[], layout: Layout): Map<string, number> {
  const out = new Map<string, number>();
  for (const kind of ["lesson", "decision"] as const) {
    const right = LANES.map(() => Number.NEGATIVE_INFINITY);
    for (const s of shared.filter((n) => n.kind === kind).sort((a, b) => a.t - b.t)) {
      const x = layout.xAt(s.t);
      const lane = Math.max(
        0,
        right.findIndex((r) => r < x - 14),
      );
      right[lane] = x + 18 + s.label.length * 6.6;
      out.set(s.id, LANES[lane] ?? 0);
    }
  }
  return out;
}

/** Where an edge attaches: a bar at the moment in question, or a lesson or decision in its band. */
export function anchor(id: string, t: number, l: Lookup): { x: number; y: number } | undefined {
  const s = l.shared.get(id);
  if (s) {
    const band = s.kind === "lesson" ? l.layout.bands.lessons : l.layout.bands.decisions;
    return { x: l.layout.xAt(s.t), y: band + (l.bandDy.get(s.id) ?? 0) };
  }
  const k = l.tasks.get(id);
  const y = k ? l.layout.rowY.get(k.agentId) : undefined;
  if (!k || y === undefined) return undefined;
  const end = k.t1 ?? Math.max(t, k.t0);
  return { x: l.layout.xAt(Math.min(Math.max(t, k.t0), end)), y };
}

/** Catches show while open and briefly after; afterwards only when one of their ends is selected. */
export function catchOpacity(
  c: BoardCatch,
  t: number,
  layout: Layout,
  selected: string | null,
): number | null {
  if (t < c.t) return null;
  const open = c.until === null || t < c.until;
  const fade =
    open || c.until === null ? 1 : Math.max(0, 1 - (layout.axis.toC(t) - layout.axis.toC(c.until)) / FADE_MS);
  if (fade <= 0 && selected !== c.from && selected !== c.to) return null;
  return Math.max(fade, 0.35);
}

export function isOpen(c: BoardCatch, t: number): boolean {
  return t >= c.t && (c.until === null || t < c.until);
}

export function lastBefore<T extends { t: number }>(list: T[], t: number): T | undefined {
  let hit: T | undefined;
  for (const x of list) if (x.t <= t) hit = x;
  return hit;
}
