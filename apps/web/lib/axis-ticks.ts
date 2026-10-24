import type { TimeAxis } from "./time-axis";

export type Tick = { x: number; label: string };
/** A squeezed idle stretch, drawn as a break in the axis rather than as a jump between labels. */
export type AxisBreak = { x: number; idleMs: number };

const STEPS_S = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
const HOUR_MS = 3_600_000;

const pad2 = (n: number) => String(n).padStart(2, "0");
const zoneOffset = (t: number) => -new Date(t).getTimezoneOffset() * 60_000;

/** One format per board: elapsed m:ss for a short session, wall-clock h:mm once it spans an hour. */
export function tickLabeler(axis: TimeAxis): (t: number) => string {
  if (axis.end - axis.start < HOUR_MS) {
    return (t) => {
      const s = Math.round((t - axis.start) / 1000);
      return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
    };
  }
  return (t) => {
    const d = new Date(t);
    return `${d.getHours()}:${pad2(d.getMinutes())}`;
  };
}

/** Round times inside one unsqueezed stretch: multiples of the step counted from `origin`. */
function roundTimes(from: number, to: number, stepMs: number, origin: number): number[] {
  const out: number[] = [];
  for (let t = origin + Math.ceil((from - origin) / stepMs) * stepMs; t <= to; t += stepMs) out.push(t);
  return out;
}

/**
 * Ticks at round times, so labels step evenly (0:15, 0:30, 0:45) and gridlines sit evenly within each stretch of
 * real time. Squeezed idle gaps get a break mark instead of a tick, so no label ever jumps.
 */
export function axisTicks(
  axis: TimeAxis,
  xAt: (t: number) => number,
  pxPerS: number,
  right: number,
  minPx: number,
): { ticks: Tick[]; breaks: AxisBreak[] } {
  const clockMode = axis.end - axis.start >= HOUR_MS;
  const stepS = STEPS_S.find((s) => s * pxPerS >= minPx && (!clockMode || s >= 60)) ?? 7200;
  const stepMs = stepS * 1000;
  // Elapsed labels count from the session start; wall-clock labels land on whole local minutes.
  const origin = clockMode ? -zoneOffset(axis.start) : axis.start;
  const breaks = axis.gaps.map((g) => ({ x: (xAt(g.t0) + xAt(g.t1)) / 2, idleMs: g.t1 - g.t0 }));
  const edges = [axis.start, ...axis.gaps.flatMap((g) => [g.t0, g.t1]), axis.fromC(axis.span)];
  const label = tickLabeler(axis);
  const ticks: Tick[] = [];
  for (let i = 0; i + 1 < edges.length; i += 2) {
    const from = edges[i] ?? axis.start;
    const to = edges[i + 1] ?? from;
    for (const t of roundTimes(from, to, stepMs, origin)) {
      const x = xAt(t);
      if (x > right) break;
      const last = ticks[ticks.length - 1];
      if (last && x - last.x < minPx * 0.75) continue;
      if (breaks.some((b) => Math.abs(b.x - x) < minPx * 0.5)) continue;
      ticks.push({ x, label: label(t) });
    }
  }
  return { ticks, breaks };
}
