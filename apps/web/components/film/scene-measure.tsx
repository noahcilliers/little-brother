import type { ComponentType } from "react";
import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { CatchesBeat, LatencyBeat, PrecisionBeat } from "./measure-beats";
import { CostBeat, TokensBeat } from "./measure-cost";
import { BEAT_S, Beat } from "./measure-parts";

// "What we measure": one full-screen beat per benchmark, each zooming in and out. Numbers live in benchmarks.ts.

const START = 0.5;
const BEATS: [id: string, beat: ComponentType<{ t: number }>][] = [
  ["precision", PrecisionBeat],
  ["catches", CatchesBeat],
  ["latency", LatencyBeat],
  ["tokens", TokensBeat],
  ["cost", CostBeat],
];

/** Local clock: 0 at the scene's start. */
export function SceneMeasure({ s }: { s: number }) {
  return (
    <div className="ms">
      <span className="ms-kicker">
        <span className="fh-mask">
          <span style={rise(prog(s, 0.05, 0.4))}>What we measure</span>
        </span>
      </span>
      {BEATS.map(([id, Content], i) => {
        const t = s - START - i * BEAT_S;
        return (
          <Beat key={id} t={t}>
            <Content t={t} />
          </Beat>
        );
      })}
    </div>
  );
}
