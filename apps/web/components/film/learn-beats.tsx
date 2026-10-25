import { CLASSIFIER } from "./classifier-results";
import { prog } from "./film-clock";
import { countUp, rise } from "./film-fx";
import { LearnChart } from "./learn-chart";
import { LearnTree } from "./learn-tree";

// The self-improving loop, one idea per frame. Each beat runs on its own clock t (0 at its start).

function Title({ t, text }: { t: number; text: string }) {
  return (
    <h2 className="lb-title">
      <span className="fh-mask">
        <span style={rise(prog(t, 0.05, 0.45))}>{text}</span>
      </span>
    </h2>
  );
}

const Note = ({ t, at, children }: { t: number; at: number; children: string }) => (
  <p className="lb-note" style={{ opacity: prog(t, at, 0.4) }}>
    {children}
  </p>
);

export function LessonBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="A failed attempt becomes a lesson." />
      <div className="lb-tree">
        <LearnTree s={t * 1.6} />
      </div>
    </>
  );
}

export function LabelsBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="Decisions and outcomes become labels." />
      <b className="lb-big">{Number(countUp(CLASSIFIER.pairs, prog(t, 0.3, 1.2))).toLocaleString("en-US")}</b>
      <Note t={t} at={0.9}>
        labelled pairs · 1,669 with ground truth from agent PRs and STALE-bench
      </Note>
    </>
  );
}

export function TrainBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="Our classifier trains on them." />
      <LearnChart t={t} />
      <Note t={t} at={1.4}>
        blocking precision and pairs settled without the judge · out-of-fold by repository
      </Note>
    </>
  );
}

export function FasterBeat({ t }: { t: number }) {
  const { judgeS, modelMs } = CLASSIFIER.latency;
  return (
    <>
      <Title t={t} text="It gets faster." />
      <div className="lb-vs">
        <span>
          <small>LLM judge</small>~{judgeS} s
        </span>
        <i>→</i>
        <span className="accent" style={{ opacity: prog(t, 0.5, 0.3) }}>
          <small>pair model</small>
          {modelMs} ms
        </span>
      </div>
      <Note t={t} at={1}>
        {`${CLASSIFIER.settledShare}% of the pairs rules leave open settled without an LLM call, at ${CLASSIFIER.settledAccuracy}% accuracy`}
      </Note>
    </>
  );
}

export function PreciseBeat({ t }: { t: number }) {
  const { blockingPrecision: b, ece } = CLASSIFIER;
  return (
    <>
      <Title t={t} text="And more precise." />
      <div className="lb-vs">
        <span>
          <small>rules only</small>
          {b.rules.toFixed(2)}
        </span>
        <i>→</i>
        <span className="accent" style={{ opacity: prog(t, 0.5, 0.3) }}>
          <small>pair model</small>
          {b.model.toFixed(2)}
        </span>
      </div>
      <Note t={t} at={1}>
        {`blocking precision · calibration error ${ece.raw.toFixed(2)} → ${ece.calibrated.toFixed(2)}`}
      </Note>
    </>
  );
}

const LOOP = ["more runs", "more labels", "a better model"];

export function LoopBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="The loop closes." />
      <div className="lb-loop">
        {LOOP.map((step, i) => (
          <span key={step} style={{ opacity: prog(t, 0.3 + i * 0.35, 0.3) }}>
            {step}
            {i < LOOP.length - 1 ? <i>→</i> : <i className="back">↺</i>}
          </span>
        ))}
      </div>
      <Note t={t} at={1.4}>
        next: more labels from live runs, then a fine-tuned cross-encoder
      </Note>
    </>
  );
}
