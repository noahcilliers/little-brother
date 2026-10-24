import { LABEL_W } from "@/components/board/row-labels";
import { anchor, bandOffsets, type Lookup } from "@/lib/board-time";
import { FULL_BOARD } from "./film-board";
import { at, clamp01, easeInOut, lerp } from "./film-clock";
import { BEAT } from "./film-timeline";
import { PhoneA } from "./phone-a";
import { PhoneB } from "./phone-b";
import { BOARD_AT, BOARD_SCALE, DASH, FULL_LAYOUT, StoryDashboard } from "./story-dashboard";
import { StoryTerminal } from "./story-terminal";
import { TERM_A, TERM_B } from "./terminal-script";

// Scenes 2–3: the user's sketch. Dashboard top-middle, a phone either side, two Claude Code terminals below; the
// camera eases between them, Screen Studio style, and back out to the wide layout.

export const W = 1600;
export const H = 900;
const PHONE_A = { x: 40, y: 28, w: 220, h: 440 };
const PHONE_B = { x: 1340, y: 28, w: 220, h: 440 };
const TERM_A_BOX = { x: 40, y: 490, w: 750, h: 380 };
const TERM_B_BOX = { x: 810, y: 490, w: 750, h: 380 };

type Point = [x: number, y: number];
const center = (b: { x: number; y: number; w: number; h: number }, fy = 0.5): Point => [
  b.x + b.w / 2,
  b.y + b.h * fy,
];
const lookup: Lookup = {
  tasks: new Map(FULL_BOARD.tasks.map((k) => [k.id, k])),
  goals: new Map(FULL_BOARD.goals.map((g) => [g.id, g])),
  shared: new Map(FULL_BOARD.shared.map((x) => [x.id, x])),
  layout: FULL_LAYOUT,
  bandDy: bandOffsets(FULL_BOARD.shared, FULL_LAYOUT),
};
/** A task bar or lesson on the dashboard, in stage pixels. */
function onBoard(id: string, s: number): Point {
  const p = anchor(id, at(s), lookup) ?? { x: 0, y: 0 };
  const bx = 1 + LABEL_W + p.x;
  const by = 53 + p.y;
  return [DASH.x + 1 + BOARD_AT.x + bx * BOARD_SCALE, DASH.y + 31 + BOARD_AT.y + by * BOARD_SCALE];
}
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const WIDE: Point = [W / 2, H / 2];

type Shot = [s: number, zoom: number, at: Point];
// biome-ignore format: one camera move per row
const SHOTS: Shot[] = [
  [0, 1, WIDE], [5.6, 1.9, [1130, 130]], [6.9, 1.9, center(PHONE_A)], [8.7, 1.8, [1080, 330]],
  [9.9, 1.25, [560, 250]], [10.4, 1.7, center(TERM_A_BOX, 0.4)], [12.1, 1.7, center(TERM_B_BOX, 0.4)],
  [13.5, 1.45, [1300, 420]], [15.6, 1, WIDE],
  [19.3, 1.9, mid(onBoard("j2", BEAT.dup), onBoard("n1", BEAT.dup))], [20.7, 1.6, center(TERM_B_BOX, 0.6)], [22.2, 1, WIDE],
  [23.3, 1.6, center(TERM_A_BOX, 0.6)], [24.9, 1.9, mid(onBoard("a2", BEAT.stale), onBoard("s1", BEAT.stale))], [26.6, 1, WIDE],
  [28.8, 1.7, mid(onBoard("a4", BEAT.conflict), onBoard("n4", BEAT.conflict))], [32.1, 1.9, [1150, 150]],
  [33.3, 1.3, [800, 250]], [34.3, 1.95, center(PHONE_A)], [36.7, 1.7, center(TERM_A_BOX, 0.62)], [38.6, 1, WIDE],
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
    <div className="fs-world" style={{ transform: camera(s, still) }}>
      <PhoneA s={s} {...PHONE_A} />
      <StoryDashboard s={s} />
      <PhoneB s={s} {...PHONE_B} />
      <StoryTerminal s={s} lines={TERM_A} title="ash@mbp — ~/lb-demo-shop — claude" {...TERM_A_BOX} />
      <StoryTerminal s={s} lines={TERM_B} title="joshua@mbp — ~/lb-demo-shop — claude" {...TERM_B_BOX} />
    </div>
  );
}
