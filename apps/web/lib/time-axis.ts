// Idle stretches longer than GAP_CAP shrink to GAP_KEEP so a session with pauses still reads as one story.
const GAP_CAP = 20_000;
const GAP_KEEP = 4_000;

export type TimeAxis = {
  start: number;
  /** Compressed length of the session, plus a little room after the last node. */
  span: number;
  toC: (t: number) => number;
  fromC: (c: number) => number;
};

function segment(list: number[], v: number): number {
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((list[mid] ?? 0) <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Maps wall time to compressed time and back, piecewise-linear over the node timestamps. */
export function timeAxis(times: number[], fallback: number): TimeAxis {
  const T = [...new Set(times)].sort((a, b) => a - b);
  if (T.length === 0) T.push(fallback);
  const C = [0];
  for (let i = 1; i < T.length; i++) {
    const gap = (T[i] ?? 0) - (T[i - 1] ?? 0);
    C.push((C[i - 1] ?? 0) + (gap > GAP_CAP ? GAP_KEEP : gap));
  }
  const tFirst = T[0] ?? fallback;
  const tLast = T[T.length - 1] ?? fallback;
  const cLast = C[C.length - 1] ?? 0;
  const lerp = (from: number[], to: number[], v: number) => {
    const i = segment(from, v);
    const a = from[i] ?? 0;
    const b = from[i + 1];
    if (b === undefined || b === a) return to[i] ?? 0;
    return (to[i] ?? 0) + ((v - a) / (b - a)) * ((to[i + 1] ?? 0) - (to[i] ?? 0));
  };
  return {
    start: tFirst,
    span: cLast + GAP_KEEP,
    toC: (t) => {
      if (t <= tFirst) return 0;
      if (t >= tLast) return cLast + Math.min(t - tLast, GAP_KEEP);
      return lerp(T, C, t);
    },
    fromC: (c) => {
      if (c <= 0) return tFirst;
      if (c >= cLast) return tLast + (c - cLast);
      return lerp(C, T, c);
    },
  };
}
