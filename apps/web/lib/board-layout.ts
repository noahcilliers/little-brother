import type { BoardAgent, BoardNode } from "./api";
import { type TimeAxis, timeAxis } from "./time-axis";

export type Point = { x: number; y: number };
export type Lane = { id: string; y: number; handle: string; color: number };
export type Band = { key: "lesson" | "decision"; y: number };
export type Layout = {
  width: number;
  height: number;
  pos: Map<string, Point>;
  lanes: Lane[];
  bands: Band[];
  axis: TimeAxis;
  /** When an abandoned step greys out: once its agent is back on the main line. */
  abandonAt: Map<string, number>;
  xAt: (t: number) => number;
};

const LABEL_EDGE = 96;
const MIN_WIDTH = 940;
// Fit the session into the card when it is short; long sessions keep a readable minimum and scroll.
const FIT_WIDTH = 760;
const PX_MIN = 0.008;
const PX_MAX = 0.034;
const BRANCH_UP = 52;
const BLOCK_DOWN = 44;

export function halfWidth(n: Pick<BoardNode, "glyph" | "label" | "band">): number {
  if (n.glyph === "intent") return (n.label.length * 6.4 + 26) / 2;
  if (n.band || n.glyph === "verify") return Math.max(16, n.label.length * 3.4);
  return 11;
}

/** Streams top to bottom, with LESSONS after the first and DECISIONS after the second (as in the prototype). */
function rows(agents: BoardAgent[]) {
  const lanes: Lane[] = [];
  const bands: Band[] = [];
  let y = 90;
  agents.forEach((a, i) => {
    if (i === 1 || i === 2) {
      bands.push({ key: i === 1 ? "lesson" : "decision", y: y + 87 });
      y += 174;
    } else if (i > 2) y += 150;
    lanes.push({ id: a.id, y, handle: a.handle, color: a.color });
  });
  for (const key of (["lesson", "decision"] as const).slice(bands.length)) {
    y += 87;
    bands.push({ key, y });
  }
  return { lanes, bands, bottom: y };
}

export function layoutBoard(agents: BoardAgent[], nodes: BoardNode[], fallback: number): Layout {
  const axis = timeAxis(
    nodes.map((n) => n.at),
    fallback,
  );
  const { lanes, bands, bottom } = rows(agents);
  const laneY = new Map(lanes.map((l) => [l.id, l.y]));
  const bandY = new Map(bands.map((b) => [b.key, b.y]));
  const first = lanes[0]?.y ?? 90;
  const midY = (first + (lanes[lanes.length - 1]?.y ?? first)) / 2;

  const PX_PER_MS = Math.min(PX_MAX, Math.max(PX_MIN, FIT_WIDTH / Math.max(1, axis.span)));
  const pos = new Map<string, Point>();
  // Spacing is enforced per row (lane, band) and per track within a lane (main, abandoned above, blocked below).
  const lastRow = new Map<string, number>();
  const lastTrack = new Map<string, { x: number; half: number }>();
  const anchors: { t: number; x: number }[] = [];
  let maxX = 0;
  for (const n of nodes) {
    const key = n.band ?? n.agentId ?? "verify";
    const track = n.abandoned ? "up" : n.glyph === "blocked" ? "down" : "main";
    const half = halfWidth(n);
    const prev = lastTrack.get(`${key}:${track}`) ?? { x: LABEL_EDGE - 6, half: 0 };
    const x = Math.max(
      LABEL_EDGE + axis.toC(n.at) * PX_PER_MS + half,
      prev.x + prev.half + half + 10,
      (lastRow.get(key) ?? 0) + 20,
    );
    lastTrack.set(`${key}:${track}`, { x, half });
    lastRow.set(key, x);
    const lane = n.agentId ? (laneY.get(n.agentId) ?? first) : midY;
    const y = n.band
      ? (bandY.get(n.band) ?? first)
      : n.glyph === "verify"
        ? midY
        : lane + (n.abandoned ? -BRANCH_UP : n.glyph === "blocked" ? BLOCK_DOWN : 0);
    pos.set(n.id, { x, y });
    anchors.push({ t: n.at, x: Math.max(x, anchors[anchors.length - 1]?.x ?? 0) });
    maxX = Math.max(maxX, x + half);
  }

  const abandonAt = new Map<string, number>();
  for (const n of nodes) {
    if (!n.abandoned) continue;
    const back = nodes.find(
      (m) => m.agentId === n.agentId && m.at > n.at && !m.abandoned && !m.band && m.glyph !== "blocked",
    );
    abandonAt.set(n.id, back?.at ?? Number.POSITIVE_INFINITY);
  }

  const xAt = (t: number) => {
    const lastA = anchors[anchors.length - 1];
    if (!lastA) return LABEL_EDGE;
    if (t >= lastA.t) return lastA.x + (axis.toC(t) - axis.toC(lastA.t)) * PX_PER_MS;
    const i = anchors.findIndex((a) => a.t > t);
    const b = anchors[i];
    const a = anchors[i - 1];
    if (!b) return lastA.x;
    if (!a) return Math.min(b.x, LABEL_EDGE + axis.toC(t) * PX_PER_MS);
    const f = (axis.toC(t) - axis.toC(a.t)) / Math.max(1, axis.toC(b.t) - axis.toC(a.t));
    return a.x + f * (b.x - a.x);
  };

  const width = Math.max(MIN_WIDTH, maxX + 70, xAt(axis.fromC(axis.span)) + 30);
  return { width, height: bottom + 70, pos, lanes, bands, axis, abandonAt, xAt };
}
