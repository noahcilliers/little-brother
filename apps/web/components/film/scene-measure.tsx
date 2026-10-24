import type { ComponentType } from "react";
import { BENCH, isReal, type Status } from "./benchmarks";
import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { SCENES } from "./film-timeline";
import { CatchesBeat, LatencyBeat, PrecisionBeat } from "./measure-beats";
import { CostBeat, TokensBeat } from "./measure-cost";
import { Beat } from "./measure-parts";

// "What we measure": one full-screen beat per benchmark, each zooming in and out. Numbers live in benchmarks.ts.
// Beats whose headline is still a placeholder sit out, and the rest share the scene's time, so a beat reappears
// on its own once its number is measured.

const START = 0.5;
const [FROM, TO] = SCENES.measure;
/** Seconds the beats share: the scene minus the lead-in and the next scene's transition. */
const SPAN = TO - FROM - START - 0.6;

const ALL: [id: string, status: Status, beat: ComponentType<{ t: number }>][] = [
  ["precision", BENCH.precision.status, PrecisionBeat],
  ["catches", BENCH.catches.status, CatchesBeat],
  ["latency", BENCH.latency.status, LatencyBeat],
  ["tokens", BENCH.tokensControlled.status, TokensBeat],
  ["cost", BENCH.cost.status, CostBeat],
];
const BEATS = ALL.filter(([, status]) => isReal(status));
const LEN = SPAN / Math.max(1, BEATS.length);

/** Local clock: 0 at the scene's start. */
export function SceneMeasure({ s }: { s: number }) {
  return (
    <div className="ms">
      <span className="ms-kicker">
        <span className="fh-mask">
          <span style={rise(prog(s, 0.05, 0.4))}>What we measure</span>
        </span>
      </span>
      {BEATS.map(([id, , Content], i) => {
        const t = s - START - i * LEN;
        return (
          <Beat key={id} t={t} len={LEN}>
            <Content t={t} />
          </Beat>
        );
      })}
    </div>
  );
}
