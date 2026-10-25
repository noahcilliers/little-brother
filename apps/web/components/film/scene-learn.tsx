import type { ComponentType } from "react";
import { FasterBeat, LabelsBeat, LessonBeat, LoopBeat, PreciseBeat, TrainBeat } from "./learn-beats";
import { Beat } from "./measure-parts";

// The self-improving loop as single focused beats, one idea per frame: lessons from failed paths
// (classify/lessons.ts), decisions as labels, the pair model trained on them (scripts/classifier), and what it
// buys. Numbers come from classifier-results.ts.

const START = 0.4;
// biome-ignore format: one beat per row
const BEATS: [id: string, len: number, beat: ComponentType<{ t: number }>][] = [
  ["lesson", 3.6, LessonBeat],
  ["labels", 2.3, LabelsBeat],
  ["train", 2.7, TrainBeat],
  ["faster", 2.3, FasterBeat],
  ["precise", 2.3, PreciseBeat],
  ["loop", 2.4, LoopBeat],
];
/** Film seconds the scene needs: lead-in, every beat, and the next scene's transition. */
export const LEARN_SPAN = START + BEATS.reduce((n, [, len]) => n + len, 0) + 0.6;

/** Local clock: 0 at the scene's start. */
export function SceneLearn({ s }: { s: number }) {
  let from = START;
  return (
    <div className="lb">
      {BEATS.map(([id, len, Content]) => {
        const t = s - from;
        from += len;
        return (
          <Beat key={id} t={t} len={len}>
            <Content t={t} />
          </Beat>
        );
      })}
    </div>
  );
}
