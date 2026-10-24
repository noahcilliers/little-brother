import { countUp } from "./film-fx";
import { after, Bar, MetricCard } from "./metric-card";

// Replay, latency and correctness: only measured numbers, each labelled with where it came from.

export function ReplayCard({ p }: { p: number }) {
  const a = after(p, 0.3);
  return (
    <MetricCard
      title="6-agent replay"
      source="fixtures/scenario.jsonl through the real connector + backend"
      p={p}
    >
      <div className="mc-big">
        ≈ {countUp(8.5, a, 1)}k<small>tokens saved · estimate</small>
      </div>
      <Bar label="duplicates stopped" value={3} max={3} p={after(p, 0.4)} shown={countUp(3, after(p, 0.4))} />
      <Bar
        label="stale paths avoided"
        value={2}
        max={3}
        p={after(p, 0.55)}
        shown={countUp(2, after(p, 0.55))}
      />
      <Bar label="ordering waits" value={2} max={3} p={after(p, 0.7)} shown={countUp(2, after(p, 0.7))} />
    </MetricCard>
  );
}

// Log scale, 50 ms to 20 s, so a 150 ms budget and a 6.9 s judge both read.
const LO = Math.log10(0.05);
const HI = Math.log10(20);
const X0 = 150;
const XW = 300;
const xOf = (sec: number) => X0 + ((Math.log10(sec) - LO) / (HI - LO)) * XW;

// biome-ignore format: tabular scenario data
const LAT: [label: string, from: number, to: number, value: string, tag: string, async: boolean][] = [
  ["edit-path check", 0.05, 0.15, "< 150 ms", "budget", false],
  ["hook round trip", 0.4, 0.5, "≈ 0.4–0.5 s", "measured, incl. Node start-up", false],
  ["LLM judge", 0.05, 6.9, "≈ 6.9 s avg", "async · off the edit path", true],
];

export function LatencyCard({ p }: { p: number }) {
  const axis = after(p, 0.2, 0.6);
  return (
    <MetricCard title="Latency" source="log scale · judge average from production, fully async" p={p}>
      <svg viewBox="0 0 470 210" className="mc-svg" aria-hidden="true">
        <path
          d={`M${X0} 176 H${X0 + XW}`}
          pathLength={1}
          className="mc-axis"
          style={{ strokeDashoffset: 1 - axis }}
        />
        {[0.1, 1, 10].map((v) => (
          <g key={v} style={{ opacity: axis }}>
            <path d={`M${xOf(v)} 20 V176`} className="mc-grid" />
            <text x={xOf(v)} y={196} textAnchor="middle" className="mc-tick">
              {v < 1 ? `${v * 1000} ms` : `${v} s`}
            </text>
          </g>
        ))}
        {LAT.map(([label, from, to, value, tag, async], i) => {
          const g = after(p, 0.4 + i * 0.25, 0.7);
          const x0 = xOf(from);
          const w = (xOf(to) - x0) * g;
          const y = 30 + i * 50;
          return (
            <g key={label}>
              <text x={0} y={y + 14} className="mc-tick strong">
                {label}
              </text>
              <rect
                x={x0}
                y={y}
                width={Math.max(w, 2)}
                height={20}
                rx={4}
                className={async ? "mc-rect hatch" : "mc-rect"}
              />
              <text x={x0 + w + 8} y={y + 14} className="mc-tick strong" style={{ opacity: g }}>
                {value}
              </text>
              <text x={X0} y={y + 36} className="mc-tick" style={{ opacity: g }}>
                {tag}
              </text>
            </g>
          );
        })}
      </svg>
    </MetricCard>
  );
}

export function CorrectCard({ p }: { p: number }) {
  const won = Math.floor(20 * after(p, 0.3, 1));
  const ring = after(p, 0.5, 0.9);
  return (
    <MetricCard
      title="Correctness"
      source="race test, 20 runs · small eval set (10 pairs) · targets are targets"
      p={p}
    >
      <div className="mc-split">
        <div>
          <div className="mc-dots">
            {Array.from({ length: 20 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid of 20 trial dots
              <i key={i} className={i < won ? "on" : ""} />
            ))}
          </div>
          <p>
            <b>{won}/20</b> races: exactly one winner, owner never denied
          </p>
        </div>
        <div>
          <svg viewBox="0 0 100 100" className="mc-ring" aria-hidden="true">
            <circle cx={50} cy={50} r={40} className="mc-ring-bg" />
            <circle
              cx={50}
              cy={50}
              r={40}
              pathLength={1}
              className="mc-ring-fg"
              style={{ strokeDashoffset: 1 - ring }}
            />
            <text x={50} y={57} textAnchor="middle">
              {countUp(10, ring)}/10
            </text>
          </svg>
          <p>semantic-conflict pairs judged correctly, after the prompt fix</p>
        </div>
      </div>
      <div className="mc-targets" style={{ opacity: after(p, 1.2, 0.4) }}>
        <span>
          precision ≥ 0.85 · block / serialize <em>target</em>
        </span>
        <span>
          recall ≥ 0.80 <em>target</em>
        </span>
      </div>
    </MetricCard>
  );
}
