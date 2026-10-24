import type { CSSProperties } from "react";
import { window01 } from "./film-clock";
import { BEAT } from "./film-timeline";
import { around, type Box, boardBox, H, onBoard, type Point, W } from "./story-geometry";

// Spotlights for the moments that matter: everything else dims, a ring and a leader line point at the element,
// and a short callout says why it matters. Drawn in stage pixels, so they ride along with the camera.

type Side = "left" | "right" | "top" | "bottom";
type Callout = { id: string; from: number; to: number; rect: Box; side: Side; at: Point; text: string };

const dupRect = around([onBoard("j2", BEAT.dup), onBoard("n1", BEAT.dup)], 26);
const staleRect = around([onBoard("a2", BEAT.stale), onBoard("s1", BEAT.stale)], 26);

// biome-ignore format: one callout per row
const CALLOUTS: Callout[] = [
  { id: "admit", from: 9.05, to: 10.2, rect: { x: 899, y: 338, w: 392, h: 100 }, side: "left", at: [860, 300], text: "The host controls who joins" },
  { id: "dup", from: 20.8, to: 21.7, rect: dupRect, side: "right", at: [dupRect.x + dupRect.w + 40, dupRect.y - 10], text: "Caught at the plan, not at merge" },
  { id: "deny", from: 22.2, to: 23.3, rect: { x: 820, y: 672, w: 730, h: 78 }, side: "top", at: [1185, 620], text: "Stopped before any work was wasted" },
  { id: "stale", from: 25.4, to: 26.6, rect: staleRect, side: "bottom", at: [staleRect.x + staleRect.w / 2, staleRect.y + staleRect.h + 36], text: "A teammate's failed path becomes everyone's lesson" },
  { id: "diff", from: 33.7, to: 34.95, rect: boardBox({ x: 222, y: 166, w: 894, h: 210 }), side: "right", at: [1160, 250], text: "Each works alone. Together, login breaks" },
  { id: "decided", from: 37.1, to: 38.5, rect: { x: 48, y: 736, w: 734, h: 90 }, side: "top", at: [415, 676], text: "The decision reaches the agent mid-task" },
];

/** Where the leader line leaves the spotlight: the middle of the side facing the callout. */
function edge(r: Box, side: Side): Point {
  if (side === "left") return [r.x, r.y + r.h / 2];
  if (side === "right") return [r.x + r.w, r.y + r.h / 2];
  if (side === "top") return [r.x + r.w / 2, r.y];
  return [r.x + r.w / 2, r.y + r.h];
}

function boxStyle({ side, at }: Callout, shown: number): CSSProperties {
  const [x, y] = at;
  const shift = (1 - shown) * 10;
  const place: Record<Side, CSSProperties> = {
    left: { right: W - x, top: y, transform: `translate(${-shift}px, -50%)` },
    right: { left: x, top: y, transform: `translate(${shift}px, -50%)` },
    top: { left: x, bottom: H - y, transform: `translate(-50%, ${-shift}px)` },
    bottom: { left: x, top: y, transform: `translate(-50%, ${shift}px)` },
  };
  return { ...place[side], opacity: shown };
}

export function StoryCallouts({ s }: { s: number }) {
  return (
    <>
      {CALLOUTS.map((c) => {
        const shown = window01(s, c.from, c.to, 0.3);
        if (shown <= 0) return null;
        const [ex, ey] = edge(c.rect, c.side);
        const { x, y, w, h } = c.rect;
        return (
          <div key={c.id} className="co">
            <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              <defs>
                <filter id={`co-soft-${c.id}`}>
                  <feGaussianBlur stdDeviation={14} />
                </filter>
                <mask id={`co-mask-${c.id}`}>
                  <rect width={W} height={H} fill="white" />
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={16}
                    fill="black"
                    filter={`url(#co-soft-${c.id})`}
                  />
                </mask>
              </defs>
              <rect
                width={W}
                height={H}
                className="co-dim"
                mask={`url(#co-mask-${c.id})`}
                style={{ opacity: shown }}
              />
              <rect x={x} y={y} width={w} height={h} rx={14} className="co-ring" style={{ opacity: shown }} />
              <path
                d={`M${ex} ${ey} L${c.at[0]} ${c.at[1]}`}
                pathLength={1}
                className="co-line"
                style={{ strokeDashoffset: 1 - shown }}
              />
              <circle cx={ex} cy={ey} r={4} className="co-dot" style={{ opacity: shown }} />
            </svg>
            <p className="co-box" style={boxStyle(c, shown)}>
              {c.text}
            </p>
          </div>
        );
      })}
    </>
  );
}
