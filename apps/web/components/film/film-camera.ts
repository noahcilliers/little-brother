import { BAR_H, layoutBoard } from "@/lib/board-layout";
import { anchor, bandOffsets, type Lookup } from "@/lib/board-time";
import { FULL_BOARD } from "./film-board";
import { at, clamp01, DURATION, easeInOut } from "./film-clock";

// Screen Studio-style camera: the dashboard is laid out once on a fixed stage, and the camera eases between shots
// aimed at whatever just happened. Stage geometry mirrors the CSS in film.css (padding, top bar, gaps, pane size).

export const LAYOUT = layoutBoard(FULL_BOARD, at(DURATION));
const PAD = 16;
const TOP_BAR = 34;
const GAP = 12;
const LABELS = 120;
const SESS_H = 214;
export const STAGE_W = 1340;
const GRAPH_TOP = PAD + TOP_BAR + GAP;
const SESS_TOP = GRAPH_TOP + LAYOUT.height + 14 + GAP;
export const STAGE_H = SESS_TOP + SESS_H + PAD;

const lookup: Lookup = {
  tasks: new Map(FULL_BOARD.tasks.map((k) => [k.id, k])),
  shared: new Map(FULL_BOARD.shared.map((s) => [s.id, s])),
  layout: LAYOUT,
  bandDy: bandOffsets(FULL_BOARD.shared, LAYOUT),
};

type Point = [x: number, y: number];
const CENTER: Point = [STAGE_W / 2, STAGE_H / 2];

/** Where a task bar (at story second s) or a lesson sits on the stage. */
function on(id: string, s: number): Point {
  const p = anchor(id, at(s), lookup);
  return p ? [PAD + 1 + LABELS + p.x, GRAPH_TOP + 7 + p.y] : CENTER;
}
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - BAR_H / 2];
/** The bottom of agent i's session pane, where new lines land. */
const pane = (i: number): Point => [
  PAD + ((STAGE_W - 2 * PAD + GAP) / 3) * (i + 0.5) - GAP / 2,
  SESS_TOP + 130,
];
const verify: Point = [PAD + LABELS + LAYOUT.xAt(at(40.6)) + 50, GRAPH_TOP + LAYOUT.height - 40];

type Shot = [s: number, zoom: number, at: Point];
// biome-ignore format: one camera move per row
const SHOTS: Shot[] = [
  [0, 1, CENTER],
  [6.8, 1.55, mid(on("n2", 8.4), on("s1", 11))],
  [10.2, 1.75, mid(on("j2", 11), on("n1", 11))],
  [12.2, 1.7, pane(0)],
  [14.4, 1, CENTER],
  [16, 1.75, mid(on("a3", 17), on("s1", 17))],
  [18.4, 1.7, pane(2)],
  [21, 1, CENTER],
  [24.4, 1.6, mid(on("a5", 26), on("n4", 26))],
  [27, 1.22, [STAGE_W / 2, 250]],
  [32.8, 1.6, pane(2)],
  [35.4, 1, CENTER],
  [40, 1.8, verify],
  [42.2, 1.7, [520, 120]],
  [44.2, 1, CENTER],
];
const MOVE_S = 1.25;

function cameraAt(s: number): [number, number, number] {
  let i = 0;
  while (i + 1 < SHOTS.length && (SHOTS[i + 1]?.[0] ?? Number.POSITIVE_INFINITY) <= s) i++;
  const cur = SHOTS[i] ?? [0, 1, CENTER];
  const prev = SHOTS[Math.max(0, i - 1)] ?? cur;
  const p = i === 0 ? 1 : easeInOut(clamp01((s - cur[0]) / MOVE_S));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  return [lerp(prev[1], cur[1]), lerp(prev[2][0], cur[2][0]), lerp(prev[2][1], cur[2][1])];
}

/** CSS transform for the stage inside a viewport `width` px wide; `still` holds the wide shot. */
export function stageTransform(s: number, width: number, still: boolean): string {
  const base = width / STAGE_W;
  const [z, rawX, rawY] = still ? [1, CENTER[0], CENTER[1]] : cameraAt(s);
  const hw = STAGE_W / 2 / z;
  const hh = STAGE_H / 2 / z;
  const cx = Math.min(STAGE_W - hw, Math.max(hw, rawX));
  const cy = Math.min(STAGE_H - hh, Math.max(hh, rawY));
  const k = base * z;
  return `translate(${(STAGE_W / 2) * base - cx * k}px, ${(STAGE_H / 2) * base - cy * k}px) scale(${k})`;
}
