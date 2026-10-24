import { LABEL_W } from "@/components/board/row-labels";
import { anchor, bandOffsets, type Lookup } from "@/lib/board-time";
import { FULL_BOARD } from "./film-board";
import { at } from "./film-clock";
import { BOARD_AT, BOARD_SCALE, DASH, FULL_LAYOUT } from "./story-dashboard";

// Where things sit on the story stage, so the camera and the callouts can aim at them.

export const W = 1600;
export const H = 900;
export type Box = { x: number; y: number; w: number; h: number };
export type Point = [x: number, y: number];

export const PHONE_A: Box = { x: 40, y: 28, w: 220, h: 440 };
export const PHONE_B: Box = { x: 1340, y: 28, w: 220, h: 440 };
export const TERM_A_BOX: Box = { x: 40, y: 490, w: 750, h: 380 };
export const TERM_B_BOX: Box = { x: 810, y: 490, w: 750, h: 380 };
export const WIDE: Point = [W / 2, H / 2];

export const center = (b: Box, fy = 0.5): Point => [b.x + b.w / 2, b.y + b.h * fy];
export const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

const lookup: Lookup = {
  tasks: new Map(FULL_BOARD.tasks.map((k) => [k.id, k])),
  goals: new Map(FULL_BOARD.goals.map((g) => [g.id, g])),
  shared: new Map(FULL_BOARD.shared.map((x) => [x.id, x])),
  layout: FULL_LAYOUT,
  bandDy: bandOffsets(FULL_BOARD.shared, FULL_LAYOUT),
};

/** A task bar or lesson on the dashboard at story second s, in stage pixels. */
export function onBoard(id: string, s: number): Point {
  const p = anchor(id, at(s), lookup) ?? { x: 0, y: 0 };
  const bx = 1 + LABEL_W + p.x;
  const by = 53 + p.y;
  return [DASH.x + 1 + BOARD_AT.x + bx * BOARD_SCALE, DASH.y + 31 + BOARD_AT.y + by * BOARD_SCALE];
}

/** A box in board pixels (inside the scaled dashboard), in stage pixels. */
export function boardBox(b: Box): Box {
  return {
    x: DASH.x + 1 + BOARD_AT.x + b.x * BOARD_SCALE,
    y: DASH.y + 31 + BOARD_AT.y + b.y * BOARD_SCALE,
    w: b.w * BOARD_SCALE,
    h: b.h * BOARD_SCALE,
  };
}

/** The box around a set of points, padded. */
export function around(points: Point[], pad: number): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}
