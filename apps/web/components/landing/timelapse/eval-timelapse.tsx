"use client";

import "./timelapse.css";
import type { LandingEvals } from "@lb/core";
import { ClassifierCompare } from "./classifier-compare";
import { LiveEvals } from "./live-evals";
import { TerminalReplay } from "./terminal-replay";

function Body({ data }: { data: LandingEvals }) {
  return (
    <>
      {data.replay ? <TerminalReplay key={data.replay.runKey} replay={data.replay} /> : null}
      {data.classifier ? (
        <>
          <div className="sec-head tl-sub">
            <h3>Instant on the easy pairs, the judge only for the hard ones</h3>
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
        <h2>Watch a catch happen</h2>
        <p>A recorded eval run: two agents, overlapping tasks, one repo. Sped up.</p>
      </div>
      <LiveEvals render={(data) => <Body data={data} />} />
    </section>
  );
}
