import { CAM_MOVE, CAMERA, CURSOR } from "./film-story";

export const STAGE_W = 1200;
export const STAGE_H = 660;

/** The last entry whose start time (first element) is at or before t. */
export function lastBefore<T extends readonly [number, ...unknown[]]>(list: readonly T[], t: number): T | undefined {
  let hit: T | undefined;
  for (const item of list) if (item[0] <= t) hit = item;
  return hit;
}

export function mmss(t: number): string {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Wall-clock time shown in the event table: the scenario runs 10:21 onward at 18x. */
export function clock(t: number): string {
  const s = 21 * 60 + Math.round(t * 18);
  return `10:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const easeCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const easeQuad = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/** Screen Studio-style zoom: [zoom, cx, cy] eased from the previous shot. */
function cameraAt(t: number): [number, number, number] {
  let i = 0;
  while (i + 1 < CAMERA.length && (CAMERA[i + 1]?.[0] ?? Infinity) <= t) i++;
  const cur = CAMERA[i] ?? [0, 1, 600, 330];
  const prev = CAMERA[Math.max(0, i - 1)] ?? cur;
  const p = i === 0 ? 1 : easeCubic(Math.min(1, (t - cur[0]) / CAM_MOVE));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  return [lerp(prev[1], cur[1]), lerp(prev[2], cur[2]), lerp(prev[3], cur[3])];
}

/** CSS transform for the stage inside a viewport `width` px wide. */
export function stageTransform(t: number, width: number, still: boolean): string {
  const base = width / STAGE_W;
  const [z, rawX, rawY] = still ? [1, 600, 330] : cameraAt(t);
  const cx = Math.min(STAGE_W - 600 / z, Math.max(600 / z, rawX));
  const cy = Math.min(STAGE_H - 330 / z, Math.max(330 / z, rawY));
  const s = base * z;
  return `translate(${600 * base - cx * s}px, ${330 * base - cy * s}px) scale(${s})`;
}

/** The pointer that clicks Approve on the resolve pane, or null while hidden. */
export function cursorAt(t: number): { transform: string } | null {
  const [a, b, c] = CURSOR;
  if (!a || !b || !c || t < a[0] || t > c[0]) return null;
  const e = easeQuad(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))));
  const s = t >= 29.85 && t < 30.15 ? 0.85 : 1;
  return { transform: `translate(${a[1] + (b[1] - a[1]) * e}px, ${a[2] + (b[2] - a[2]) * e}px) scale(${s})` };
}
