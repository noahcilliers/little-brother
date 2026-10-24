import { BENCH } from "./benchmarks";
import { prog } from "./film-clock";
import { countUp } from "./film-fx";
import { BigNumber, MBar, Tag } from "./measure-parts";

// The five benchmark beats. Every number comes from benchmarks.ts.

export function PrecisionBeat({ t }: { t: number }) {
  const b = BENCH.precision;
  return (
    <>
      <h3 className="ms-label">{b.label}</h3>
      <BigNumber t={t} bound={b.bound} value={b.value} unit={b.unit} status={b.status} />
      <div className="ms-bars">
        <MBar
          t={t}
          delay={0.7}
          name="Little Brother"
          value={b.value}
          max={100}
          shown={`${b.bound}${b.value}%`}
          accent
        />
        {b.baselines.map((x, i) => (
          <MBar
            key={x.name}
            t={t}
            delay={0.9 + i * 0.15}
            name={x.name}
            value={x.value}
            max={100}
            shown={`${x.value}%`}
          />
        ))}
        <Tag status={b.baselineStatus} />
      </div>
    </>
  );
}

// The measured run planted duplicates and stale paths; conflicts weren't in that suite.
const KINDS = ["duplicate", "stale"];

export function CatchesBeat({ t }: { t: number }) {
  const b = BENCH.catches;
  return (
    <>
      <h3 className="ms-label">{b.label}</h3>
      <BigNumber t={t} value={b.value} unit={` ${b.unit}`} status={b.status} />
      <div className="ms-checks">
        {KINDS.map((k, i) => {
          const on = prog(t, 0.6 + i * 0.3, 0.3);
          return (
            <span key={k} style={{ opacity: on, transform: `scale(${0.6 + on * 0.4})` }}>
              <svg viewBox="-12 -12 24 24" aria-hidden="true">
                <circle r={11} />
                <path d="M-5 0 l3.5 3.5 l7 -7" />
              </svg>
              {k}
            </span>
          );
        })}
      </div>
    </>
  );
}

export function LatencyBeat({ t }: { t: number }) {
  const b = BENCH.latency;
  const llm = b.baselines[0];
  return (
    <>
      <h3 className="ms-label">{b.label}</h3>
      <BigNumber t={t} bound={b.bound} value={b.value} unit={` ${b.unit}`} status={b.status} />
      <div className="ms-stack" style={{ opacity: prog(t, 0.6, 0.3) }}>
        {b.parts.map((p, i) => (
          <i
            key={p.name}
            className="ms-seg"
            style={{ width: `${(p.value / b.value) * 100 * prog(t, 0.7 + i * 0.2, 0.4)}%` }}
          >
            <span>
              {p.name} ≤ {p.value} ms
            </span>
          </i>
        ))}
        <em>budget {b.value} ms</em>
      </div>
      {llm ? (
        <div className="ms-off" style={{ opacity: prog(t, 1.5, 0.3) }}>
          <span>{llm.name}</span>
          <b>~{countUp(llm.value / 1000, prog(t, 1.5, 0.6), 0)} s</b>
          <Tag status={b.baselineStatus} />
        </div>
      ) : null}
    </>
  );
}
