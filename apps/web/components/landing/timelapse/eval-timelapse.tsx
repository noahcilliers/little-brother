"use client";

import "./timelapse.css";
import type { LandingEvals } from "@lb/core";
import { ClassifierCompare } from "./classifier-compare";
import { LiveEvals } from "./live-evals";
import { TerminalReplay } from "./terminal-replay";

function counted(data: LandingEvals): { runs: number; voided: number } {
  return data.summaries.reduce((n, s) => ({ runs: n.runs + s.runs, voided: n.voided + s.voided }), {
    runs: 0,
    voided: 0,
  });
}

function Body({ data, live }: { data: LandingEvals; live: boolean }) {
  const { runs, voided } = counted(data);
  return (
    <>
      {data.replay ? <TerminalReplay key={data.replay.runKey} replay={data.replay} live={live} /> : null}
      {runs > 0 ? (
        <p className="tl-runs">
          One of {runs.toLocaleString("en-US")} published eval runs
          {voided ? `; ${voided} rate-limited runs are excluded from every number` : ""}.
        </p>
      ) : null}
      {data.classifier ? (
        <>
          <div className="sec-head tl-sub">
            <div>
              <span className="label">The classifier</span>
              <h3>Instant on the easy pairs, the judge only for the hard ones</h3>
            </div>
            <p>
              Every pair of agent actions no rule settles goes to our pair model first. When it is confident
              it answers on the spot; otherwise it hands the pair to the LLM judge.
            </p>
          </div>
          <ClassifierCompare bench={data.classifier} />
        </>
      ) : null}
    </>
  );
}

/** Landing section: a real eval run replayed as terminal logs, then our classifier against the judge. */
export function EvalTimelapse() {
  return (
    <section id="replay">
      <div className="sec-head">
        <div>
          <span className="label">Replay</span>
          <h2>Watch a catch happen</h2>
        </div>
        <p>
          A recorded eval run: two Claude Code agents get overlapping tasks on the same repo, then an
          integrator merges their branches and runs the checks. Timestamps are real, the playback is sped up.
        </p>
      </div>
      <LiveEvals render={(data, live) => <Body data={data} live={live} />} />
    </section>
  );
}
