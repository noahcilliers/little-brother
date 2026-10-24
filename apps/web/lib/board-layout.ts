import type { Board } from "./api";
import { type TimeAxis, timeAxis } from "./time-axis";

// Geometry of the prototype: agent rows 160 then 140 apart, LESSONS between the first two rows and DECISIONS
// between the next two, bars 30 high, 110 px of row labels on the left.
export const LEFT = 110;
export const BAR_H = 30;
export const AXIS_TOP = 30;
const FIRST_ROW = 92;
const FIT_WIDTH = 1500;
const PX_PER_S_MIN = 4;
const PX_PER_S_MAX = 56;
const TICK_MIN_PX = 50;
const STEPS_S = [1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

export type Tick = { x: number; label: string };
export type Layout = {
  axis: TimeAxis;
  width: number;
  height: number;
  /** Wall-clock ms → x. */
  xAt: (t: number) => number;
  rowY: Map<string, number>;
  bands: { lessons: number; decisions: number };
  ticks: Tick[];
};

/** Every timestamp the board draws, so the axis bends only through idle stretches. */
function boardTimes(b: Board): number[] {
  const out: number[] = [];
  for (const g of b.goals) out.push(g.t0, ...(g.t1 === null ? [] : [g.t1]));
  for (const k of b.tasks) {
    out.push(k.t0, ...(k.t1 === null ? [] : [k.t1]), ...k.actions.map((a) => a.t));
    if (k.supersededAt !== undefined) out.push(k.supersededAt);
  }
  for (const s of b.shared) out.push(s.t);
  for (const c of b.catches) out.push(c.t, ...(c.until === null ? [] : [c.until]));
  for (const s of b.sessions) for (const l of s.lines) out.push(l.t);
  for (const v of b.verifies) out.push(v.t);
  return out;
}

function rows(agentIds: string[]) {
  const rowY = new Map<string, number>();
  let y = FIRST_ROW;
  agentIds.forEach((id, i) => {
    rowY.set(id, y);
    y += i === 0 ? 160 : 140;
  });
  const ys = [...rowY.values()];
  const mid = (i: number) => {
    const a = ys[i];
    const b = ys[i + 1];
    // With fewer rows than bands, the band takes the next row slot below the last agent.
    if (a !== undefined && b !== undefined) return (a + b) / 2;
    return (ys[ys.length - 1] ?? FIRST_ROW) + 80 * (i + 2 - ys.length);
  };
  const bands = { lessons: mid(0), decisions: mid(1) };
  const bottom = Math.max(...ys, bands.lessons, bands.decisions) + 78;
  return { rowY, bands, height: bottom };
}

function tickLabel(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 120 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function layoutBoard(b: Board, now: number): Layout {
  const axis = timeAxis(boardTimes(b), now);
  const spanS = axis.span / 1000;
  const px = Math.min(PX_PER_S_MAX, Math.max(PX_PER_S_MIN, (FIT_WIDTH - LEFT - 100) / Math.max(spanS, 1)));
  const xAt = (t: number) => LEFT + (axis.toC(t) / 1000) * px;
  const width = Math.max(FIT_WIDTH, Math.ceil(LEFT + spanS * px + 60));
  const { rowY, bands, height } = rows(b.agents.map((a) => a.id));
  const step = STEPS_S.find((s) => s * px >= TICK_MIN_PX) ?? 3600;
  const ticks: Tick[] = [];
  for (let k = 0; LEFT + k * step * px <= width - 20; k++) {
    const c = k * step * 1000;
    ticks.push({ x: LEFT + k * step * px, label: k % 2 ? "" : tickLabel(axis.fromC(c) - axis.start) });
  }
  return { axis, width, height, xAt, rowY, bands, ticks };
}
