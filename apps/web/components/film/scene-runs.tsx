import type { ComponentType } from "react";
import { clamp01, prog } from "./film-clock";
import { rise } from "./film-fx";
import { Beat } from "./measure-parts";
import { RunsTimelapse } from "./runs-timelapse";
import { ArmsBeat, BugsBeat, ConvexBeat, PublicBeat, WhyStill } from "./runs-why";

// "How we measure": a timelapse of two real benchmark batches running, then why we run them, one callout at a
// time over the finished grid. Sits between the learning loop and the results it produces.

/** Local seconds over which the batches play from first run to last. */
const TL_FROM = 0.4;
const TL_TO = 5;
const WHY_AT = 5.2;
// biome-ignore format: one beat per row
const WHY: [id: string, len: number, beat: ComponentType<{ t: number }>][] = [
  ["public", 1.8, PublicBeat],
  ["arms", 1.8, ArmsBeat],
  ["bugs", 2.6, BugsBeat],
  ["convex", 1.6, ConvexBeat],
];
/** Film seconds the scene needs: timelapse, every callout, and the next scene's transition. */
export const RUNS_SPAN = WHY_AT + WHY.reduce((n, [, len]) => n + len, 0) + 0.6;

/** Local clock: 0 at the scene's start. Reduced motion shows the finished grid with every callout at once. */
export function SceneRuns({ s, still }: { s: number; still: boolean }) {
  const u = still ? 1 : clamp01((s - TL_FROM) / (TL_TO - TL_FROM));
  const dim = still ? 1 : prog(s, WHY_AT - 0.2, 0.5);
  let from = WHY_AT;
  return (
    <div className="rn">
      <span className="ms-kicker">
        <span className="fh-mask">
          <span style={rise(still ? 1 : prog(s, 0.05, 0.4))}>How we measure</span>
        </span>
      </span>
      <div
        className="rn-stage"
        style={{
          opacity: 1 - 0.86 * dim,
          filter: `blur(${dim * 3}px)`,
          transform: `scale(${1 - 0.03 * dim})`,
        }}
      >
        <RunsTimelapse u={u} sPerU={TL_TO - TL_FROM} />
      </div>
      {still ? (
        <WhyStill />
      ) : (
        WHY.map(([id, len, Content]) => {
          const t = s - from;
          from += len;
          return (
            <Beat key={id} t={t} len={len}>
              <Content t={t} />
            </Beat>
          );
        })
      )}
    </div>
  );
}
