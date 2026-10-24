import type { LogRow } from "@/lib/log-rows";
import { DECIDER, relationText } from "@/lib/log-rows";

type Verdict = NonNullable<LogRow["verdict"]>;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Everything the classifier recorded for one comparison, including the judge's full reasoning. */
export function VerdictDetails({ verdict }: { verdict: Verdict }) {
  const { step, v } = verdict;
  return (
    <>
      <div className="detail-block">
        <span className="field-label">Step · {step.kind}</span>
        <p className="detail-text">
          <b>@{step.handle}</b> {step.text}
        </p>
      </div>
      {v.against ? (
        <div className="detail-block">
          <span className="field-label">Compared with</span>
          <p className="detail-text">
            <b>@{v.against.handle}</b> {v.against.text}
          </p>
        </div>
      ) : null}
      <dl className="meta-list">
        <dt>Relation</dt>
        <dd>{relationText(v.relation)}</dd>
        <dt>Type</dt>
        <dd>{v.type}</dd>
        <dt>Action</dt>
        <dd>{v.action}</dd>
        <dt>Decided by</dt>
        <dd>{DECIDER[v.source]}</dd>
        <dt>Confidence</dt>
        <dd>{pct(v.confidence)}</dd>
        <dt>Latency</dt>
        <dd>{v.latencyMs} ms</dd>
        <dt>Status</dt>
        <dd>{v.status}</dd>
      </dl>
      <div className="detail-block">
        <span className="field-label">Reasoning</span>
        <p className="detail-text">{v.reason || "No reason recorded."}</p>
      </div>
      {v.evidence.length > 0 ? (
        <div className="detail-block">
          <span className="field-label">Evidence</span>
          <ul className="evidence">
            {v.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
