import { LEARNING_CURVE } from "@/components/film/classifier-results";

// The learning curve as a static chart: blocking precision and macro-F1 (solid, dashed) against the share of
// training data, plus the share of open pairs settled without the judge.

const W = 640;
const H = 280;
const L = 56;
const R = 150;
const T = 16;
const B = 40;
const x = (share: number) => L + ((share - 10) / 90) * (W - L - R);
const y = (v: number) => T + (1 - (v - 0.4) / 0.6) * (H - T - B);
type Row = (typeof LEARNING_CURVE)[number];
const SERIES: [name: string, pick: (r: Row) => number, cls: string][] = [
  ["settled without judge", (r) => r.settled, "s3"],
  ["blocking precision", (r) => r.blockingPrecision, "s1"],
  ["macro-F1", (r) => r.macroF1, "s2"],
];

export function CurveChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rp-curve" role="img" aria-label="Pair model learning curve">
      <title>Pair model learning curve</title>
      {[0.4, 0.6, 0.8, 1].map((v) => (
        <g key={v}>
          <path d={`M${L} ${y(v)} H${W - R}`} className="grid" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {LEARNING_CURVE.map((r) => (
        <text key={r.share} x={x(r.share)} y={H - 14} textAnchor="middle">
          {r.share}%
        </text>
      ))}
      {SERIES.map(([name, pick, cls]) => {
        const last = LEARNING_CURVE[LEARNING_CURVE.length - 1];
        const d = LEARNING_CURVE.map((r, i) => `${i ? "L" : "M"}${x(r.share)} ${y(pick(r))}`).join(" ");
        return (
          <g key={name} className={cls}>
            <path d={d} className="line" />
            {LEARNING_CURVE.map((r) => (
              <circle key={r.share} cx={x(r.share)} cy={y(pick(r))} r={3.5} />
            ))}
            {last ? (
              <text x={x(100) + 10} y={y(pick(last)) + 4} className="end">
                {name}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
