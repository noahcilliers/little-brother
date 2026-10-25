import type { BenchRun } from "@lb/core";
import { armName, duration, runOutcome, usd } from "@/lib/bench-format";
import { ago, kTokens } from "@/lib/format";

/** The latest graded runs, newest first; a run that just landed slides in. */
export function RunFeed({ runs, now }: { runs: BenchRun[]; now: number }) {
  return (
    <aside className="bm-feed" aria-labelledby="bm-feed-title">
      <h2 id="bm-feed-title" className="label">
        Latest runs
      </h2>
      {runs.length ? (
        <ol aria-live="polite">
          {runs.map((r) => (
            <li key={r.runKey} className="bm-run" data-arm={r.arm} data-voided={r.voided || undefined}>
              <div className="bm-run-head">
                <span className="bm-arm">{armName(r.arm)}</span>
                <span className="bm-case">
                  {r.caseId} #{r.run}
                </span>
              </div>
              <span className="bm-outcome">{runOutcome(r)}</span>
              <small>
                {r.suite} · {usd(r.costUsd)} · {kTokens(r.newTokens)} tok · {duration(r.wallSec)} ·{" "}
                {ago(r.landedAt, now)}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="bm-empty">No runs graded yet.</p>
      )}
    </aside>
  );
}
