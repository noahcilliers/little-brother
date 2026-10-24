import type { ComponentType } from "react";
import { clamp01, easeInOut, lerp, prog } from "./film-clock";
import { rise } from "./film-fx";
import { CorrectCard, LatencyCard, ReplayCard } from "./metric-cards-a";
import { CostCard, LearningCard, ProvidersCard } from "./metric-cards-b";

// Scene 6: six cards, each revealed and zoomed in turn, then the wide grid. Only measured numbers; targets and
// qualitative bars say so on the card.

const T0 = 56.3;
const EACH = 1.9;
const COL_W = 490;
const ROW_H = 360;
const LEFT = 40;
const TOP = 130;
const GAP = 24;

const CARDS: [id: string, card: ComponentType<{ p: number }>][] = [
  ["replay", ReplayCard],
  ["latency", LatencyCard],
  ["correct", CorrectCard],
  ["cost", CostCard],
  ["providers", ProvidersCard],
  ["learning", LearningCard],
];
const box = (i: number) => ({
  x: LEFT + (i % 3) * (COL_W + GAP),
  y: TOP + Math.floor(i / 3) * (ROW_H + GAP),
});

function camera(s: number, still: boolean): string {
  if (still) return "none";
  const i = Math.min(CARDS.length, Math.max(-1, Math.floor((s - T0) / EACH)));
  const zoomed = (k: number): [number, number, number] => {
    if (k < 0 || k >= CARDS.length) return [1, 800, 450];
    const b = box(k);
    return [1.7, b.x + COL_W / 2, b.y + ROW_H / 2];
  };
  const cur = zoomed(i);
  const prev = zoomed(i - 1);
  const p = easeInOut(clamp01((s - T0 - i * EACH) / 0.7));
  const z = lerp(prev[0], cur[0], p);
  const hw = 800 / z;
  const hh = 450 / z;
  const cx = Math.min(1600 - hw, Math.max(hw, lerp(prev[1], cur[1], p)));
  const cy = Math.min(900 - hh, Math.max(hh, lerp(prev[2], cur[2], p)));
  return `translate(${800 - cx * z}px, ${450 - cy * z}px) scale(${z})`;
}

export function SceneMetrics({ s, still }: { s: number; still: boolean }) {
  return (
    <div className="fx-metrics" style={{ transform: camera(s, still) }}>
      <h2 className="fx-title left">
        <span className="fh-mask">
          <span style={rise(prog(s, T0 - 0.3, 0.5))}>What we measured.</span>
        </span>
        <small style={{ opacity: prog(s, T0, 0.4) }}>
          Sources on every card. Targets are labelled as targets.
        </small>
      </h2>
      {CARDS.map(([id, Card], i) => {
        const b = box(i);
        return (
          <div key={id} className="fx-card-slot" style={{ left: b.x, top: b.y, width: COL_W, height: ROW_H }}>
            <Card p={Math.max(0, s - T0 - i * EACH + 0.4)} />
          </div>
        );
      })}
    </div>
  );
}
