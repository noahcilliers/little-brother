import { prog } from "./film-clock";
import { countUp, rise } from "./film-fx";
import { GitPanel, MdPanel } from "./why-panels";

// "Why not just git? Or a shared .md file?": what each misses, then the answer, a nudge at the moment of action.

const ANSWER = 5.2;

function Answer({ s }: { s: number }) {
  const t = s - ANSWER;
  const path = prog(t, 0.4, 1.2);
  return (
    <div className="wy-answer" style={{ opacity: prog(t, 0, 0.4) }}>
      <h2 className="wy-title">
        <span className="fh-mask">
          <span style={rise(prog(t, 0.1, 0.5))}>A nudge at the moment of action.</span>
        </span>
      </h2>
      <svg viewBox="0 0 700 300" className="wy-nudge" aria-hidden="true">
        <path
          d="M40 150 H330"
          pathLength={1}
          className="wy-agent"
          style={{ strokeDashoffset: 1 - Math.min(1, path * 2) }}
        />
        <path d="M330 150 H620" className="wy-ghost" style={{ opacity: prog(t, 0.6, 0.3) * 0.6 }} />
        <rect
          x={600}
          y={110}
          width={14}
          height={80}
          rx={4}
          className="wy-wall"
          style={{ opacity: prog(t, 0.6, 0.3) }}
        />
        <circle cx={330} cy={150} r={12} className="wy-nudge-dot" style={{ opacity: prog(t, 0.8, 0.2) }} />
        <path
          d="M330 150 C420 150 440 60 560 60 H640"
          pathLength={1}
          className="wy-agent"
          style={{ strokeDashoffset: 1 - prog(t, 1, 0.8) }}
        />
        <circle cx={650} cy={60} r={14} className="wy-goal" style={{ opacity: prog(t, 1.7, 0.3) }} />
      </svg>
      <div className="wy-stats">
        <div style={{ opacity: prog(t, 1.4, 0.4) }}>
          <b>{countUp(82, prog(t, 1.4, 0.9))}%</b>
          <span>of failed team runs fixed by one heads-up about a teammate's change</span>
          <small>Passes Alone, Fails Together · 2026 · constructed tasks</small>
        </div>
      </div>
    </div>
  );
}

/** Local clock: 0 at the scene's start. */
export function SceneWhy({ s }: { s: number }) {
  const away = prog(s, ANSWER - 0.2, 0.5);
  return (
    <div className="wy">
      <div
        className="wy-first"
        style={{ opacity: 1 - away, transform: `scale(${1 - away * 0.06}) translateY(${-away * 30}px)` }}
      >
        <h2 className="wy-title">
          <span className="fh-mask">
            <span style={rise(prog(s, 0.05, 0.5))}>Why not just git? Or a shared .md file?</span>
          </span>
        </h2>
        <div className="wy-panels">
          <GitPanel s={s} />
          <MdPanel s={s} />
        </div>
      </div>
      {s >= ANSWER - 0.1 ? <Answer s={s} /> : null}
    </div>
  );
}
