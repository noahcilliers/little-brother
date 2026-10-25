import { clamp01, easeInOut, lerp } from "./film-clock";
import { BEAT } from "./film-timeline";
import { PhoneA } from "./phone-a";
import { PhoneB } from "./phone-b";
import { StoryCallouts } from "./story-callouts";
import { StoryDashboard } from "./story-dashboard";
import {
  center,
  H,
  mid,
  onBoard,
  PHONE_A,
  PHONE_B,
  type Point,
  TERM_A_BOX,
  TERM_B_BOX,
  W,
  WIDE,
} from "./story-geometry";
import { StoryTerminal } from "./story-terminal";
import { TERM_A, TERM_B } from "./terminal-script";

// The user's sketch: dashboard top-middle, a phone either side, two Claude Code terminals below. The camera eases
// between them, Screen Studio style, and holds while a callout makes the point.

export { W } from "./story-geometry";

type Shot = [s: number, zoom: number, at: Point];
// biome-ignore format: one camera move per row
const SHOTS: Shot[] = [
  [0, 1, WIDE], [5.6, 1.9, [1130, 130]], [6.9, 1.9, center(PHONE_A)], [8.7, 1.8, [1060, 320]],
  [10.3, 1.7, center(TERM_A_BOX, 0.4)], [12.1, 1.7, center(TERM_B_BOX, 0.4)], [13.5, 1.45, [1300, 420]], [15.6, 1, WIDE],
  [19.3, 1.9, mid(onBoard("j2", BEAT.dup), onBoard("n1", BEAT.dup))], [21.6, 1.6, center(TERM_B_BOX, 0.55)],
  [23.3, 1.6, center(TERM_A_BOX, 0.6)], [24.9, 1.9, mid(onBoard("a2", BEAT.stale), onBoard("s1", BEAT.stale))], [26.7, 1, WIDE],
  [28.8, 1.7, mid(onBoard("a4", BEAT.conflict), onBoard("n4", BEAT.conflict))], [32.1, 1.9, [1150, 150]],
  [33.3, 1.3, [820, 250]], [35, 1.95, center(PHONE_A)], [36.7, 1.7, center(TERM_A_BOX, 0.55)], [38.6, 1, WIDE],
];
const MOVE_S = 1.1;

function camera(s: number, still: boolean): string {
  if (still) return "none";
  let i = 0;
  while (i + 1 < SHOTS.length && (SHOTS[i + 1]?.[0] ?? Number.POSITIVE_INFINITY) <= s) i++;
  const cur = SHOTS[i] ?? [0, 1, WIDE];
  const prev = SHOTS[Math.max(0, i - 1)] ?? cur;
  const p = i === 0 ? 1 : easeInOut(clamp01((s - cur[0]) / MOVE_S));
  const z = lerp(prev[1], cur[1], p);
  const hw = W / 2 / z;
  const hh = H / 2 / z;
  const cx = Math.min(W - hw, Math.max(hw, lerp(prev[2][0], cur[2][0], p)));
  const cy = Math.min(H - hh, Math.max(hh, lerp(prev[2][1], cur[2][1], p)));
  return `translate(${W / 2 - cx * z}px, ${H / 2 - cy * z}px) scale(${z})`;
}

/** s is the film clock; the story keeps its own beats on it. */
export function SceneStory({ s, still }: { s: number; still: boolean }) {
  return (
    <>
      <div className="fs-world" style={{ transform: camera(s, still) }}>
        <PhoneA s={s} {...PHONE_A} />
        <StoryDashboard s={s} />
        <PhoneB s={s} {...PHONE_B} />
        <StoryTerminal s={s} lines={TERM_A} title="ash@mbp — ~/lb-demo-shop — claude" {...TERM_A_BOX} />
        <StoryTerminal s={s} lines={TERM_B} title="joshua@mbp — ~/lb-demo-shop — claude" {...TERM_B_BOX} />
        <StoryCallouts s={s} />
      </div>
      <span className="fs-tag">illustrative</span>
    </>
  );
}
