import { LABEL_W } from "@/components/board/row-labels";
import { layoutBoard } from "@/lib/board-layout";
import { anchor, bandOffsets, type Lookup } from "@/lib/board-time";
import { FULL_BOARD } from "./film-board";
import { at, clamp01, DURATION, easeInOut } from "./film-clock";

// Screen Studio-style camera: the dashboard is laid out once on a fixed-width stage, and the camera eases between
// shots aimed at whatever just happened. Positions come from the rendered stage, so board styling can change freely.

export const LAYOUT = layoutBoard(FULL_BOARD, at(DURATION));
// Stage padding, graph card border and right padding around the labels column and the timeline.
export const STAGE_W = 32 + 8 + LABEL_W + LAYOUT.width;

type Point = [x: number, y: number];
export type Geometry = {
  w: number;
  h: number;
  /** Top-left of the timeline SVG. */
  graph: Point;
  /** Where each session pane's newest lines land. */
  panes: Point[];
  counts: Point;
};

export const GUESS: Geometry = {
  w: STAGE_W,
  h: 800,
  graph: [17 + LABEL_W, 69],
  panes: [0, 1, 2].map((i): Point => [(STAGE_W * (i * 2 + 1)) / 6, 700]),
  counts: [STAGE_W / 3, 33],
};

/** Reads the rendered stage in its own (untransformed) pixels. */
export function measure(app: HTMLElement): Geometry {
  const box = app.getBoundingClientRect();
  const k = box.width / app.offsetWidth || 1;
  const rel = (el: Element | null, fx: number, fy: number): Point => {
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    return [(r.left - box.left + r.width * fx) / k, (r.top - box.top + r.height * fy) / k];
  };
  return {
    w: app.offsetWidth,
    h: app.offsetHeight,
    graph: rel(app.querySelector(".graph .scroll svg"), 0, 0),
    panes: [...app.querySelectorAll(".sess ol")].map((ol) => rel(ol, 0.5, 0.62)),
    counts: rel(app.querySelector(".bar .counts"), 0.5, 0.5),
  };
}

const lookup: Lookup = {
  tasks: new Map(FULL_BOARD.tasks.map((k) => [k.id, k])),
  goals: new Map(FULL_BOARD.goals.map((g) => [g.id, g])),
  shared: new Map(FULL_BOARD.shared.map((s) => [s.id, s])),
  layout: LAYOUT,
  bandDy: bandOffsets(FULL_BOARD.shared, LAYOUT),
};

type Shot = [s: number, zoom: number, at: Point];
const MOVE_S = 1.25;

/** The shot list, aimed using the measured stage. */
export function shots(g: Geometry): Shot[] {
  const center: Point = [g.w / 2, g.h / 2];
  const on = (id: string, s: number): Point => {
    const p = anchor(id, at(s), lookup);
    return p ? [g.graph[0] + p.x, g.graph[1] + p.y] : center;
  };
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const pane = (i: number) => g.panes[i] ?? center;
  const verify: Point = [g.graph[0] + LAYOUT.xAt(at(41.2)) + 40, g.graph[1] + LAYOUT.height - 60];
  // biome-ignore format: one camera move per row
  return [
    [0, 1, center],
    [6.8, 1.55, mid(on("n2", 8.4), on("s1", 11))],
    [10.2, 1.75, mid(on("j2", 11), on("n1", 11))],
    [12.2, 1.7, pane(0)],
    [14.4, 1, center],
    [16, 1.75, mid(on("a3", 17), on("s1", 17))],
    [18.4, 1.7, pane(2)],
    [21, 1, center],
    [24.4, 1.6, mid(on("a5", 26), on("n4", 26))],
    [27, 1.22, [g.w / 2, 280]],
    [32.8, 1.6, pane(2)],
    [35.4, 1, center],
    [40.4, 1.8, verify],
    [42.2, 1.8, g.counts],
    [44.2, 1, center],
  ];
}

function cameraAt(list: Shot[], s: number): [number, number, number] {
  let i = 0;
  while (i + 1 < list.length && (list[i + 1]?.[0] ?? Number.POSITIVE_INFINITY) <= s) i++;
  const cur = list[i];
  if (!cur) return [1, 0, 0];
  const prev = list[Math.max(0, i - 1)] ?? cur;
  const p = i === 0 ? 1 : easeInOut(clamp01((s - cur[0]) / MOVE_S));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  return [lerp(prev[1], cur[1]), lerp(prev[2][0], cur[2][0]), lerp(prev[2][1], cur[2][1])];
}

/** CSS transform for the stage inside a viewport `width` px wide; `still` holds the wide shot. */
export function stageTransform(list: Shot[], g: Geometry, s: number, width: number, still: boolean): string {
  const base = width / g.w;
  const [z, rawX, rawY] = still ? [1, g.w / 2, g.h / 2] : cameraAt(list, s);
  const hw = g.w / 2 / z;
  const hh = g.h / 2 / z;
  const cx = Math.min(g.w - hw, Math.max(hw, rawX));
  const cy = Math.min(g.h - hh, Math.max(hh, rawY));
  const k = base * z;
  return `translate(${(g.w / 2) * base - cx * k}px, ${(g.h / 2) * base - cy * k}px) scale(${k})`;
}
