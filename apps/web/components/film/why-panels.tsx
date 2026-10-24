import { prog } from "./film-clock";
import { countUp } from "./film-fx";

// The two things teams try first, each with what it can't see, and the sourced numbers behind it.

function Big({ value, label, p }: { value: string; label: string; p: number }) {
  return (
    <div className="wy-big" style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function GitPanel({ s }: { s: number }) {
  const draw = prog(s, 0.5, 0.9);
  const merged = prog(s, 1.4, 0.3);
  const broke = prog(s, 2.2, 0.3);
  return (
    <section className="wy-panel" style={{ opacity: prog(s, 0.2, 0.4) }}>
      <span className="wy-chip">git</span>
      <h3>Sees conflicts only at merge, and only textual ones.</h3>
      <svg viewBox="0 0 600 200" className="wy-svg" aria-hidden="true">
        <path d="M20 100 H580" className="wy-main" />
        <path
          d="M80 100 C140 100 140 40 200 40 H340 C400 40 400 100 440 100"
          pathLength={1}
          className="wy-branch"
          style={{ strokeDashoffset: 1 - draw }}
        />
        <path
          d="M80 100 C140 100 140 160 200 160 H340 C400 160 400 100 440 100"
          pathLength={1}
          className="wy-branch"
          style={{ strokeDashoffset: 1 - draw }}
        />
        <g style={{ opacity: merged }}>
          <circle cx={440} cy={100} r={16} className="wy-ok" />
          <path d="M432 100 l6 6 l10 -12" className="wy-tick" />
          <text x={440} y={148} textAnchor="middle" className="wy-svg-label">
            merged clean
          </text>
        </g>
        <g
          style={{ opacity: broke, transform: `scale(${0.8 + broke * 0.2})`, transformOrigin: "530px 100px" }}
        >
          <rect x={480} y={78} width={100} height={44} rx={10} className="wy-bad" />
          <text x={530} y={106} textAnchor="middle" className="wy-bad-text">
            ✕ tests
          </text>
        </g>
      </svg>
      <div className="wy-row">
        <Big
          value={`${countUp(16, prog(s, 2.4, 0.8))}%`}
          label="of merges hit textual conflicts"
          p={prog(s, 2.4, 0.4)}
        />
        <Big value="4–31%" label="merged clean, then broke the build or tests" p={prog(s, 2.8, 0.4)} />
      </div>
      <small className="wy-src" style={{ opacity: prog(s, 3, 0.4) }}>
        Brun et al., ESEC/FSE 2011
      </small>
    </section>
  );
}

export function MdPanel({ s }: { s: number }) {
  const read = prog(s, 1.5, 0.9);
  return (
    <section className="wy-panel" style={{ opacity: prog(s, 1, 0.4) }}>
      <span className="wy-chip">CLAUDE.md · AGENTS.md</span>
      <h3>Advisory and static. Followed unevenly, and blind to what a teammate is doing now.</h3>
      <svg viewBox="0 0 600 200" className="wy-svg" aria-hidden="true">
        <rect x={40} y={30} width={150} height={140} rx={10} className="wy-doc" />
        {[60, 82, 104, 126, 148].map((y) => (
          <path key={y} d={`M60 ${y} H${y % 3 ? 170 : 140}`} className="wy-doc-line" />
        ))}
        <path d="M200 70 H520" pathLength={1} className="wy-follow" style={{ strokeDashoffset: 1 - read }} />
        <path
          d="M200 100 C300 100 360 100 420 140"
          pathLength={1}
          className="wy-follow dim"
          style={{ strokeDashoffset: 1 - read }}
        />
        <path
          d="M200 130 C280 130 300 180 360 190"
          pathLength={1}
          className="wy-follow faint"
          style={{ strokeDashoffset: 1 - read }}
        />
        <g style={{ opacity: prog(s, 2.5, 0.4) }}>
          <circle cx={548} cy={70} r={22} className="wy-ask" />
          <text x={548} y={78} textAnchor="middle" className="wy-ask-text">
            ?
          </text>
          <text x={548} y={118} textAnchor="middle" className="wy-svg-label">
            teammate, now?
          </text>
        </g>
      </svg>
      <blockquote style={{ opacity: prog(s, 2.8, 0.4) }}>
        Hooks give “deterministic control … rather than relying on the LLM to choose.”
        <cite>Claude Code docs</cite>
      </blockquote>
      <small className="wy-src" style={{ opacity: prog(s, 3.2, 0.4) }}>
        Compliance varies by task and over a session · arXiv 2605.10039
      </small>
    </section>
  );
}
