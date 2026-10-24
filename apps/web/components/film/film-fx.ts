import type { CSSProperties } from "react";
import { clamp01, easeInOut, lerp } from "./film-clock";
import { SCENES, type SceneId, TRANSITION_S, type Transition } from "./film-timeline";

// Reusable transitions: every scene layer gets its style from the clock, so scrubbing lands on exact frames.

const ORDER = Object.keys(SCENES) as SceneId[];

/** How a layer looks while it enters with `kind`, p running 0→1. */
function entering(kind: Transition, p: number): CSSProperties {
  switch (kind) {
    case "zoom":
      return { opacity: p, transform: `scale(${lerp(1.18, 1, p)})`, filter: `blur(${(1 - p) * 8}px)` };
    case "wipe":
      return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    case "iris":
      return { clipPath: `circle(${p * 120}% at 50% 50%)` };
    default:
      return {};
  }
}

/** How the outgoing layer looks while the next one enters with `kind`. */
function leaving(kind: Transition, p: number): CSSProperties {
  if (kind === "zoom")
    return { opacity: 1 - p, transform: `scale(${lerp(1, 1.6, p)})`, filter: `blur(${p * 6}px)` };
  if (kind === "wipe") return { transform: `translateX(${-p * 6}%)`, opacity: 1 - p * 0.5 };
  if (kind === "iris") return { transform: `scale(${lerp(1, 0.94, p)})`, opacity: 1 - p * 0.6 };
  return {};
}

/** Null when the scene is off screen; otherwise its layer style at story second s. */
export function layerStyle(id: SceneId, s: number, still: boolean): CSSProperties | null {
  const [start, end, enter] = SCENES[id];
  if (s < start || s > end) return null;
  const next = ORDER[ORDER.indexOf(id) + 1];
  const pin = easeInOut(clamp01((s - start) / TRANSITION_S));
  const nextScene = next ? SCENES[next] : undefined;
  const pout = nextScene ? easeInOut(clamp01((s - nextScene[0]) / TRANSITION_S)) : 0;
  if (still) return s >= (nextScene?.[0] ?? Number.POSITIVE_INFINITY) + TRANSITION_S / 2 ? null : {};
  return {
    ...(pin < 1 ? entering(enter, pin) : {}),
    ...(pout > 0 && nextScene ? leaving(nextScene[2], pout) : {}),
  };
}

/** The scene's own clock: seconds since it started. */
export const local = (id: SceneId, s: number) => s - SCENES[id][0];

/** A number counting up to `to` as p goes 0→1. */
export function countUp(to: number, p: number, decimals = 0): string {
  return (to * easeInOut(clamp01(p))).toFixed(decimals);
}

/** A mask reveal for one word or line: slides up from behind its own baseline. */
export function rise(p: number): CSSProperties {
  const e = easeInOut(clamp01(p));
  return { transform: `translateY(${(1 - e) * 105}%)`, opacity: e > 0 ? 1 : 0 };
}
