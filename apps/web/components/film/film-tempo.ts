import { DURATION } from "./film-clock";
import { STORY_SHIFT } from "./film-timeline";

// Playback speed per stretch of the film. Every scene, beat and camera move is timed on the film clock; this map
// decides how many real seconds each stretch gets, so the catches play slowly enough to follow without re-timing
// the dozens of beats keyed to them. Rate is film-clock seconds per second of playback.

const ST = STORY_SHIFT;
// biome-ignore format: one stretch per row
const TEMPO: [clock: number, rate: number][] = [
  [0, 0.9],          // stats, then the problem
  [ST + 5.6, 0.9],   // people join
  [ST + 19.2, 0.45], // duplicate catch
  [ST + 23.2, 0.45], // stale catch
  [ST + 28.4, 0.55], // two auth approaches diverge
  [ST + 32, 0.5],    // conflict, decided from the phone
  [ST + 38.6, 1],    // back out to the wide shot
  [42.8, 0.7],       // why not git
  [51.2, 0.65],      // how it works
  [57.6, 0.65],      // learning
  [64, 0.95],        // results
  [76, 1],           // impact
  [79.4, 1],         // close
];

/** Playback second at which each stretch starts. */
const STARTS = TEMPO.reduce<number[]>((acc, [clock], i) => {
  const prev = TEMPO[i - 1];
  const before = acc[i - 1];
  acc.push(prev && before !== undefined ? before + (clock - prev[0]) / prev[1] : 0);
  return acc;
}, []);

function segmentFor(pick: (i: number) => number, v: number): number {
  let i = 0;
  while (i + 1 < TEMPO.length && pick(i + 1) <= v) i++;
  return i;
}

/** Film-clock second shown at playback second p. */
export function clockAt(p: number): number {
  const i = segmentFor((k) => STARTS[k] ?? 0, p);
  const [clock, rate] = TEMPO[i] ?? [0, 1];
  return Math.min(DURATION, clock + (p - (STARTS[i] ?? 0)) * rate);
}

/** Playback second at which film-clock second s is shown. */
export function playbackAt(s: number): number {
  const i = segmentFor((k) => TEMPO[k]?.[0] ?? 0, s);
  const [clock, rate] = TEMPO[i] ?? [0, 1];
  return (STARTS[i] ?? 0) + (s - clock) / rate;
}

/** Total playback length in seconds. */
export const PLAYBACK_DURATION = playbackAt(DURATION);
