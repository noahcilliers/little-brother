import { RERUN, type RerunStat } from "./benchmarks";
import { prog } from "./film-clock";
import { rise } from "./film-fx";

// Why the benchmark runs exist, one short callout per beat over the finished grid. Each beat runs on its own
// clock t (0 at its start). The bugs are the ones these runs surfaced on 24 Oct: commits d1f3034 and 1490ea5.

function Title({
  t,
  at = 0.05,
  text,
  muted = false,
}: {
  t: number;
  at?: number;
  text: string;
  muted?: boolean;
}) {
  return (
    <h2 className={muted ? "rn-title muted" : "rn-title"}>
      <span className="fh-mask">
        <span style={rise(prog(t, at, 0.45))}>{text}</span>
      </span>
    </h2>
  );
}

const Note = ({ t, at, children }: { t: number; at: number; children: string }) => (
  <p className="rn-note" style={{ opacity: prog(t, at, 0.4) }}>
    {children}
  </p>
);

export function PublicBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="Our own demo can't prove it." />
      <Title t={t} at={0.4} text="Public benchmarks can." muted />
      <div className="rn-chips">
        <span className="rn-chip" style={{ opacity: prog(t, 0.8, 0.3) }}>
          STALE-bench <small>interface changes in Django</small>
        </span>
        <span className="rn-chip" style={{ opacity: prog(t, 1, 0.3) }}>
          CooperBench <small>paired features in jinja, click, dirty-equals</small>
        </span>
      </div>
    </>
  );
}

const ARMS = ["off", "messaging", "told in advance", "Little Brother"];

export function ArmsBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="Every arm runs the same agents." />
      <div className="rn-chips">
        {ARMS.map((arm, i) => (
          <span
            key={arm}
            className={i === ARMS.length - 1 ? "rn-chip accent" : "rn-chip"}
            style={{ opacity: prog(t, 0.35 + i * 0.18, 0.25) }}
          >
            {arm}
          </span>
        ))}
      </div>
      <Note t={t} at={1.1}>
        same tasks, same model · only the coordination changes
      </Note>
    </>
  );
}

const BUGS = ["Deny-once was denying every retry", "Calls inside f-strings were invisible"];

export function BugsBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="The runs found our bugs." />
      <div className="rn-fix">
        {BUGS.map((bug, i) => {
          const at = 0.35 + i * 0.7;
          return (
            <p key={bug} className="rn-fix-row">
              <span style={{ opacity: prog(t, at, 0.25) }}>{bug}</span>
              <i style={{ opacity: prog(t, at + 0.25, 0.2) }}>→</i>
              <b style={{ opacity: prog(t, at + 0.3, 0.2) }}>fixed</b>
              <i style={{ opacity: prog(t, at + 0.45, 0.2) }}>→</i>
              <em style={{ opacity: prog(t, at + 0.5, 0.2) }}>rerun ↺</em>
            </p>
          );
        })}
      </div>
      <Note t={t} at={1.8}>
        each fix lands with a test, then the batch runs again
      </Note>
    </>
  );
}

/** The rerun's numbers, only those already filled in benchmarks.ts. */
function RerunStats({ t }: { t: number }) {
  const filled = RERUN.stats.filter((x): x is RerunStat & { after: number } => x.after !== null);
  if (filled.length === 0) return null;
  return (
    <div className="rn-rerun" style={{ opacity: prog(t, 0.7, 0.35) }}>
      {filled.map((x) => (
        <span key={x.label}>
          <b>
            {x.before !== null ? `${x.before}${x.unit} → ` : ""}
            {x.after}
            {x.unit}
          </b>
          {x.label}
        </span>
      ))}
      {RERUN.note || RERUN.batch ? (
        <small>{[RERUN.batch, RERUN.note].filter(Boolean).join(" · ")}</small>
      ) : null}
    </div>
  );
}

export function ConvexBeat({ t }: { t: number }) {
  return (
    <>
      <Title t={t} text="Every run streams into Convex." />
      <Title t={t} at={0.35} text="Find a bug. Fix it. Run it again." muted />
      <RerunStats t={t} />
    </>
  );
}

/** Reduced motion: every callout at once, as one still frame. */
export function WhyStill() {
  return (
    <div className="rn-still">
      <h2 className="rn-title">Every run streams into Convex.</h2>
      <ul>
        <li>Our own demo can't prove it. Public benchmarks can: STALE-bench, CooperBench.</li>
        <li>Every arm runs the same agents: off · messaging · told in advance · Little Brother.</li>
        <li>
          The runs found our bugs: deny-once was denying every retry; calls inside f-strings were invisible.
        </li>
        <li>Each fix lands with a test, then the batch runs again.</li>
      </ul>
      <RerunStats t={10} />
    </div>
  );
}
