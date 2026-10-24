import { Graph } from "@/components/board/graph";
import { LABEL_W } from "@/components/board/row-labels";
import { TopBar } from "@/components/board/top-bar";
import { type Layout, layoutBoard } from "@/lib/board-layout";
import { agentColor } from "@/lib/format";
import { boardAt, FULL_BOARD, joinedAt } from "./film-board";
import { at, clamp01, easeInOut, lerp } from "./film-clock";
import { FilmDecision } from "./film-decision";
import { BEAT } from "./film-timeline";
import { Browser, Pointer } from "./mockups";
import { ShareOverlay, Toasts, WaitingCard } from "./story-overlays";

export const DASH = { x: 300, y: 28, w: 1000, h: 420 };
const BODY_H = DASH.h - 31;
const LAYOUTS = new Map<number, Layout>();
/** The axis covers every task whoever has joined, so bars never shift sideways as lanes appear. */
function layoutFor(ids: string[]): Layout {
  const hit = LAYOUTS.get(ids.length);
  if (hit) return hit;
  const layout = layoutBoard(
    { ...FULL_BOARD, agents: FULL_BOARD.agents.filter((a) => ids.includes(a.id)) },
    at(42),
  );
  LAYOUTS.set(ids.length, layout);
  return layout;
}
export const FULL_LAYOUT = layoutFor(FULL_BOARD.agents.map((a) => a.id));
const BOARD_W = LABEL_W + FULL_LAYOUT.width + 10;
/** Board pixels → dashboard pixels. */
export const BOARD_SCALE = (DASH.w - 18) / BOARD_W;
export const BOARD_AT = { x: 8, y: 50 };

const COLORS = new Map(FULL_BOARD.agents.map((a) => [a.id, a.color]));
const colorOf = (id: string) => agentColor(COLORS.get(id));
const noop = () => undefined;

// biome-ignore format: pointer keyframes [s, x, y] in dashboard body pixels; clicks at the BEAT times
const PATH: [s: number, x: number, y: number][] = [
  [5.2, 760, 260], [5.85, DASH.w - 62, 22], [8.95, DASH.w - 62, 22], [9.45, DASH.w - 66, BODY_H - 40],
  [10.3, DASH.w - 66, BODY_H - 40], [32.3, DASH.w - 320, 240], [32.85, DASH.w - 94, 142], [34, DASH.w - 94, 142],
];
const SHOWN: [number, number][] = [
  [5.2, 10.3],
  [32.3, 33.6],
];
const CLICKS = [BEAT.shareClick, BEAT.admit, BEAT.decideClick];

function pointerAt(s: number) {
  let i = 0;
  while (i + 1 < PATH.length && (PATH[i + 1]?.[0] ?? Number.POSITIVE_INFINITY) <= s) i++;
  const a = PATH[i] ?? [0, 0, 0];
  const b = PATH[i + 1] ?? a;
  const p = b === a ? 1 : easeInOut(clamp01((s - a[0]) / (b[0] - a[0])));
  return {
    x: lerp(a[1], b[1], p),
    y: lerp(a[2], b[2], p),
    shown: SHOWN.some(([from, to]) => s >= from && s < to),
    press: CLICKS.some((c) => Math.abs(s - c) < 0.12),
  };
}

/** The host's session page in a browser: header with Share · QR, the real board, and its pop-ups. */
export function StoryDashboard({ s }: { s: number }) {
  const ids = joinedAt(s);
  const board = boardAt(s);
  const t = at(s);
  const pointer = pointerAt(s);
  return (
    <Browser url="little-brother-gules.vercel.app/app/sessions/checkout-sprint" {...DASH}>
      <div className="d-head">
        <b>checkout sprint</b>
        <span className="d-sub">lb-demo-shop · {ids.length} people</span>
        <span className="d-tabs">
          <i className="on">Board</i>
          <i>Server log</i>
          <i>Classifier log</i>
        </span>
        <span className={pointer.press && s < 7 ? "f-btn pressed" : "f-btn"}>Share · QR</span>
      </div>
      <div
        className="d-board"
        style={{ left: BOARD_AT.x, top: BOARD_AT.y, width: BOARD_W, transform: `scale(${BOARD_SCALE})` }}
      >
        <TopBar board={board} t={t} highlight={null} onHighlight={noop} waiting={0} onOpenDecision={noop} />
        {ids.length > 0 ? (
          <Graph
            board={board}
            layout={layoutFor(ids)}
            t={t}
            follow={false}
            selected={null}
            focus={null}
            highlight={null}
            onSelect={noop}
            colorOf={colorOf}
          />
        ) : (
          <div className="card graph">
            <p className="empty">
              No agents have connected yet. Each Claude Code session with the plugin shows up here.
            </p>
          </div>
        )}
        <FilmDecision s={s} />
      </div>
      <ShareOverlay s={s} />
      <WaitingCard s={s} />
      <Toasts s={s} />
      <Pointer {...pointer} />
    </Browser>
  );
}
