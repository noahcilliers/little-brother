import { LEARNING_CURVE } from "./classifier-results";
import { prog } from "./film-clock";

// The learning curve, drawn in: blocking precision (solid) and the share of open pairs settled without the judge
// (dashed) as the training data grows. Plotted as computed, plateau included.

const W = 1000;
const H = 380;
const PAD = { l: 70, r: 200, t: 20, b: 50 };
const x = (share: number) => PAD.l + ((share - 10) / 90) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + (1 - (v - 0.5) / 0.5) * (H - PAD.t - PAD.b);
const line = (pick: (p: (typeof LEARNING_CURVE)[number]) => number) =>
  LEARNING_CURVE.map((p, i) => `${i ? "L" : "M"}${x(p.share)} ${y(pick(p))}`).join(" ");

export function LearnChart({ t }: { t: number }) {
  const draw = prog(t, 0.3, 1.4);
  const last = LEARNING_CURVE[LEARNING_CURVE.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lb-chart" aria-hidden="true">
      {[0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <path d={`M${PAD.l} ${y(v)} H${W - PAD.r}`} className="lb-grid" />
          <text x={PAD.l - 12} y={y(v) + 5} textAnchor="end" className="lb-tick">
            {v.toFixed(2)}
          </text>
        </g>
      ))}
      {LEARNING_CURVE.map((p) => (
        <text key={p.share} x={x(p.share)} y={H - 16} textAnchor="middle" className="lb-tick">
          {p.share}%
        </text>
      ))}
      <path
        d={line((p) => p.settled)}
        pathLength={1}
        className="lb-line dashed"
        style={{ strokeDashoffset: 1 - draw }}
      />
      <path
        d={line((p) => p.blockingPrecision)}
        pathLength={1}
        className="lb-line"
        style={{ strokeDashoffset: 1 - draw }}
      />
      {LEARNING_CURVE.map((p, i) => (
        <circle
          key={p.share}
          cx={x(p.share)}
          cy={y(p.blockingPrecision)}
          r={7}
          className="lb-dot"
          style={{ opacity: prog(t, 0.3 + i * 0.28, 0.2) }}
        />
      ))}
      {last ? (
        <g style={{ opacity: prog(t, 1.6, 0.3) }}>
          <text x={x(100) + 16} y={y(last.blockingPrecision) + 6} className="lb-end">
            {last.blockingPrecision.toFixed(2)} precision
          </text>
          <text x={x(100) + 16} y={y(last.settled) + 6} className="lb-end muted">
            {Math.round(last.settled * 100)}% settled
          </text>
        </g>
      ) : null}
    </svg>
  );
}
