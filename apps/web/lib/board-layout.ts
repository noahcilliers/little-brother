import type { Board } from "./api";
import { type AxisBreak, axisTicks, type Tick } from "./axis-ticks";
import { type TimeAxis, timeAxis } from "./time-axis";

export type { AxisBreak, Tick };

// Rows stack top to bottom, one per agent: a goal line (pills), then as many bar lanes as the agent's overlapping
// tasks need, then a thin band for the lessons and decisions that came out of that agent's work.
export const BAR_H = 30;
export const AXIS_TOP = 12;
const LEFT = 16;
const GOAL_LINE = 34;
const LANE_PITCH = 50;
const ROW_PAD = 6;
const BAND_H = 40;
const GAP_H = 12;
const FIT_WIDTH = 1180;
const PX_PER_S_MIN = 4;
const PX_PER_S_MAX = 56;
const TICK_MIN_PX = 64;

/** Middle of a row's goal line, where the goal pills sit. */
export const goalLineY = (row: Row): number => row.top + GOAL_LINE / 2;

export type Row = {
  agentId: string;
  top: number;
  bottom: number;
  lanes: number;
  /** Centre of the lessons/decisions band under the row; null when the agent produced none. */
  band: number | null;
};
export type Layout = {
  axis: TimeAxis;
  width: number;
  height: number;
  /** Wall-clock ms → x. */
  xAt: (t: number) => number;
  rows: Map<string, Row>;
  laneOf: Map<string, number>;
  /** Lesson/decision id → the row whose band holds it. */
  bandRow: Map<string, Row>;
  ticks: Tick[];
  /** Squeezed idle gaps, marked on the axis. */
  breaks: AxisBreak[];
};

/** Centre line of a bar lane. */
export function laneY(row: Row, lane: number): number {
  return row.top + GOAL_LINE + lane * LANE_PITCH + BAR_H / 2;
}

/** Every timestamp the board draws, so the axis bends only through idle stretches. */
function boardTimes(b: Board): number[] {
  const out: number[] = [];
  for (const g of b.goals) out.push(g.t0, ...(g.t1 === null ? [] : [g.t1]));
  for (const k of b.tasks) {
    out.push(k.t0, ...(k.t1 === null ? [] : [k.t1]), ...k.actions.map((a) => a.t));
    if (k.supersededAt !== undefined) out.push(k.supersededAt);
  }
  for (const a of b.loose) out.push(a.t);
  for (const s of b.shared) out.push(s.t);
  for (const c of b.catches) out.push(c.t, ...(c.until === null ? [] : [c.until]));
  for (const s of b.sessions) for (const l of s.lines) out.push(l.t);
  for (const v of b.verifies) out.push(v.t);
  return out;
}

/** Overlapping tasks of one agent go to separate lanes, first fit. */
function lanes(b: Board, xAt: (t: number) => number) {
  const laneOf = new Map<string, number>();
  const count = new Map<string, number>();
  const ends = new Map<string, number[]>();
  for (const k of [...b.tasks].sort((p, q) => p.t0 - q.t0)) {
    const used = ends.get(k.agentId) ?? [];
    const x0 = xAt(k.t0);
    // Only bars that really overlap stack; a label under a short bar is cut at the next bar instead.
    let lane = used.findIndex((end) => x0 >= end);
    if (lane < 0) lane = used.length;
    used[lane] = k.t1 === null ? Number.POSITIVE_INFINITY : Math.max(xAt(k.t1), x0 + 6) + 2;
    ends.set(k.agentId, used);
    laneOf.set(k.id, lane);
    count.set(k.agentId, used.length);
  }
  return { laneOf, count };
}

/** `fit` is the width the session should fill before it scrolls: the visible graph on the dashboard. */
export function layoutBoard(b: Board, now: number, fit = FIT_WIDTH): Layout {
  const axis = timeAxis(boardTimes(b), now);
  const spanS = axis.span / 1000;
  const px = Math.min(PX_PER_S_MAX, Math.max(PX_PER_S_MIN, (fit - LEFT - 80) / Math.max(spanS, 1)));
  const xAt = (t: number) => LEFT + (axis.toC(t) / 1000) * px;
  const width = Math.max(fit, Math.ceil(LEFT + spanS * px + 60));
  const { laneOf, count } = lanes(b, xAt);
  // Knowledge from an agent outside the lanes sits in the first row's band.
  const lane = new Set(b.agents.map((a) => a.id));
  const home = (agentId: string) => (lane.has(agentId) ? agentId : (b.agents[0]?.id ?? agentId));
  const sharedBy = new Set(b.shared.map((s) => home(s.agentId)));
  const rows = new Map<string, Row>();
  let y = AXIS_TOP + 8;
  for (const a of b.agents) {
    const n = Math.max(1, count.get(a.id) ?? 0);
    const bottom = y + GOAL_LINE + n * LANE_PITCH + ROW_PAD - 16;
    const hasBand = sharedBy.has(a.id);
    rows.set(a.id, { agentId: a.id, top: y, bottom, lanes: n, band: hasBand ? bottom + BAND_H / 2 : null });
    y = bottom + (hasBand ? BAND_H : GAP_H);
  }
  const height = y + 22;
  const bandRow = new Map<string, Row>();
  for (const s of b.shared) {
    const row = rows.get(home(s.agentId));
    if (row) bandRow.set(s.id, row);
  }
  const { ticks, breaks } = axisTicks(axis, xAt, px, width - 20, TICK_MIN_PX);
  return { axis, width, height, xAt, rows, laneOf, bandRow, ticks, breaks };
}
