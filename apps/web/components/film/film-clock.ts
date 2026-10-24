// The film runs in story seconds; the board it reuses works in wall-clock ms. One story second is SCALE_MS of
// board time, so the axis reads like a few minutes of real work while the film stays under a minute.

export const DURATION = 46;
const T0 = Date.UTC(2026, 9, 24, 17, 21, 0);
const SCALE_MS = 5000;

/** Board timestamp for story second s. */
export function at(s: number): number {
  return T0 + s * SCALE_MS;
}

export function mmss(s: number): string {
  const whole = Math.floor(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The last entry whose start (first element) is at or before s. */
export function lastBefore<T extends readonly [number, ...unknown[]]>(
  list: readonly T[],
  s: number,
): T | undefined {
  let hit: T | undefined;
  for (const item of list) if (item[0] <= s) hit = item;
  return hit;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
