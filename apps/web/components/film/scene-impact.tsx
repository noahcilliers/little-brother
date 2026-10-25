import { RESULTS } from "./benchmarks";
import { prog } from "./film-clock";
import { countUp, rise } from "./film-fx";

const LINES = [
  "Every duplicate stopped is tokens not burned.",
  "Every stale path pruned is a failure not repeated.",
];
const { cost, tokens, success } = RESULTS;
// biome-ignore format: one stat per row
const STATS: [pre: string, value: number, unit: string, label: string][] = [
  [cost.pre, cost.value, cost.unit, "cost per run"],
  [tokens.pre, tokens.value, tokens.unit, "new tokens per run"],
  ["67 → ", success.value, success.unit, "merged success"],
];

/** The impact beat before the close: the point, restated, with the measured off-vs-on change. Local clock. */
export function SceneImpact({ s }: { s: number }) {
  return (
    <div className="im">
      {LINES.map((line, i) => (
        <span key={line} className="fh-mask">
          <span className={i ? "im-line accent" : "im-line"} style={rise(prog(s, 0.2 + i * 0.4, 0.5))}>
            {line}
          </span>
        </span>
      ))}
      <div className="im-stats">
        {STATS.map(([pre, value, unit, label], i) => (
          <span key={label} style={{ opacity: prog(s, 1.1 + i * 0.2, 0.3) }}>
            <b>
              {pre}
              {countUp(value, prog(s, 1.1 + i * 0.2, 0.9))}
              {unit}
            </b>
            {label}
          </span>
        ))}
      </div>
      <small className="im-sample" style={{ opacity: prog(s, 1.8, 0.3) }}>
        larger tasks · Little Brother off vs on · {cost.note}
      </small>
    </div>
  );
}
