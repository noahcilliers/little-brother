import type { CSSProperties } from "react";
import { clamp01, mmss } from "./film-clock";
import { COOPER_RUNS, STALE_ELAPSED_S, STALE_RUNS } from "./runs-batch";
import { finishedBy, inSlot, type Placed, schedule, startedBy } from "./runs-schedule";
import { RunTile } from "./runs-tile";

// The benchmark timelapse: a grid of agent pairs working through two real batches, the counters racing, and every
// finished run landing in the Convex table the results page reads.

const STALE_SLOTS = 9;
const COOPER_SLOTS = 3;
const STALE = schedule(STALE_RUNS, STALE_SLOTS);
const COOPER = schedule(COOPER_RUNS, COOPER_SLOTS);
const SIDE_ROWS = 9;
const LAND_S = 0.3;

const slots = (n: number) => Array.from({ length: n }, (_, i) => i);

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <span className="rn-counter">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function Landed({ run, since }: { run: Placed; since: number }) {
  const [caseId, arm, n, , solved, outcome] = run.row;
  const e = clamp01(since / LAND_S);
  return (
    <li style={{ opacity: e, transform: `translateX(${(1 - e) * -14}px)` }}>
      <b>{caseId}</b>
      <span>
        {arm} #{n}
      </span>
      <em className={outcome || "solved"}>{outcome || `solved ${solved}`}</em>
    </li>
  );
}

/** u: batch progress 0→1; sPerU: film seconds per unit of u, so flashes and landings keep a fixed length. */
export function RunsTimelapse({ u, sPerU }: { u: number; sPerU: number }) {
  const landed = [...finishedBy(STALE, u), ...finishedBy(COOPER, u)].sort((a, b) => b.end - a.end);
  const newest = landed[0];
  const pulse = newest ? 1 - clamp01(((u - newest.end) * sPerU) / LAND_S) : 0;
  return (
    <div className="rn-tl">
      <header className="rn-top">
        <Counter label="STALE-bench" value={`run ${startedBy(STALE, u)} / ${STALE_RUNS.length}`} />
        <Counter label="CooperBench" value={`run ${startedBy(COOPER, u)} / ${COOPER_RUNS.length}`} />
        <Counter label="elapsed" value={mmss(u * STALE_ELAPSED_S)} />
        <span className="rn-badge">{u < 1 ? "▶▶ timelapse" : "batch done"}</span>
      </header>
      <div className="rn-grid">
        {slots(STALE_SLOTS).map((i) => (
          <RunTile key={`stale-${i}`} run={inSlot(STALE, i, u)} u={u} sPerU={sPerU} />
        ))}
        {slots(COOPER_SLOTS).map((i) => (
          <RunTile key={`cooper-${i}`} run={inSlot(COOPER, i, u)} u={u} sPerU={sPerU} />
        ))}
      </div>
      <aside className="rn-side" style={{ "--rn-pulse": pulse } as CSSProperties}>
        <p className="rn-side-head">
          → Convex <b>evalRuns</b>
        </p>
        <b className="rn-count">{landed.length}</b>
        <small className="rn-side-sub">rows · the results board reads them live</small>
        <ol className="rn-rows">
          {landed.slice(0, SIDE_ROWS).map((r) => (
            <Landed key={`${r.row[0]}-${r.row[1]}-${r.row[2]}`} run={r} since={(u - r.end) * sPerU} />
          ))}
        </ol>
      </aside>
    </div>
  );
}
