import "./batch-card.css";
import type { BenchBatch } from "@lb/core";
import { armName } from "@/lib/bench-format";
import { ago } from "@/lib/format";
import { ArmTable } from "./arm-table";

const share = (n: number, of: number) => `${of ? Math.min(100, (n / of) * 100) : 0}%`;

function When({ batch, now }: { batch: BenchBatch; now: number }) {
  if (batch.startedAt === null) return <>published after the run</>;
  const started = `started ${ago(batch.startedAt, now)}`;
  if (batch.finishedAt === null) return <>{started}</>;
  const mins = Math.max(1, Math.round((batch.finishedAt - batch.startedAt) / 60_000));
  return (
    <>
      {started} · finished in {mins} min
    </>
  );
}

/** One batch: what ran, how far along it is, and the per-arm numbers so far. */
export function BatchCard({ batch, now }: { batch: BenchBatch; now: number }) {
  const counted = batch.graded - batch.voided;
  return (
    <article className="bm-batch" data-status={batch.status}>
      <header className="bm-batch-head">
        <div>
          <span className="label">{batch.suite}</span>
          <h3>{batch.model}</h3>
        </div>
        <span className="bm-status">
          {batch.status === "running" ? <i className="bm-dot" aria-hidden="true" /> : null}
          {batch.status}
        </span>
      </header>
      <p className="bm-meta">
        {batch.arms.map(armName).join(" vs ")} · <When batch={batch} now={now} />
      </p>
      <div
        className="bm-progress"
        role="progressbar"
        aria-label={`${batch.graded} of ${batch.planned} runs graded`}
        aria-valuemin={0}
        aria-valuemax={batch.planned}
        aria-valuenow={batch.graded}
      >
        <span className="bm-fill" style={{ width: share(counted, batch.planned) }} />
        <span className="bm-void" style={{ width: share(batch.voided, batch.planned) }} />
      </div>
      <p className="bm-count">
        <b>
          {batch.graded} of {batch.planned} runs
        </b>
        {batch.voided ? `, ${batch.voided} voided` : ""}
        {batch.skipped ? `, ${batch.skipped} skipped at the cost cap` : ""}
      </p>
      <ArmTable arms={batch.perArm} />
      <small className="bm-id">{batch.batch}</small>
    </article>
  );
}
