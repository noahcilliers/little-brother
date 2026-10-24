// One clock drives the whole film, in story seconds. The dashboard it reuses works in wall-clock ms: one story
// second is SCALE_MS of board time, so the board's axis reads like minutes of real work.

export const DURATION = 88;
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
export const easeOut = (p: number) => 1 - (1 - p) ** 3;
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Eased 0→1 progress of s through [a, a + dur]. */
export function prog(s: number, a: number, dur = 0.5, ease: (p: number) => number = easeOut): number {
  return ease(clamp01((s - a) / dur));
}

/** Shown between a and b, fading over `fade` seconds at each end. */
export function window01(s: number, a: number, b: number, fade = 0.3): number {
  return Math.min(prog(s, a, fade), 1 - prog(s, b - fade, fade));
}

/** The part of `text` typed by story second s, at `cps` characters a second from t0. */
export function typed(text: string, s: number, t0: number, cps = 30): string {
  return text.slice(0, Math.max(0, Math.floor((s - t0) * cps)));
}
