import { RESULTS } from "./benchmarks";
import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { SCENES } from "./film-timeline";
import { ResultBeat } from "./measure-beats";
import { Beat } from "./measure-parts";

// "What we measure": one full-screen beat per eval result, each zooming in and out. Numbers live in benchmarks.ts;
// the beats share the scene's time, so adding or removing a result there needs no change here.

const START = 0.5;
const [FROM, TO] = SCENES.measure;
/** Seconds the beats share: the scene minus the lead-in and the next scene's transition. */
const SPAN = TO - FROM - START - 0.6;
const BEATS = Object.entries(RESULTS);
const LEN = SPAN / Math.max(1, BEATS.length);

/** Local clock: 0 at the scene's start. */
export function SceneMeasure({ s }: { s: number }) {
  return (
    <div className="ms">
      <span className="ms-kicker">
        <span className="fh-mask">
          <span style={rise(prog(s, 0.05, 0.4))}>What we measured</span>
        </span>
      </span>
      {BEATS.map(([id, r], i) => {
        const t = s - START - i * LEN;
        return (
          <Beat key={id} t={t} len={LEN}>
            <ResultBeat t={t} r={r} />
          </Beat>
        );
      })}
    </div>
  );
}
