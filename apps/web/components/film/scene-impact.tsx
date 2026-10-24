import { BENCH, isReal } from "./benchmarks";
import { prog } from "./film-clock";
import { countUp, rise } from "./film-fx";

const LINES = [
  "Every duplicate stopped is tokens not burned.",
  "Every stale path pruned is a failure not repeated.",
];

/** The impact beat before the close: the point, restated, with the saving counting up once it is measured. */
export function SceneImpact({ s }: { s: number }) {
  const r = BENCH.tokensReplay;
  const n = prog(s, 1.2, 1.4);
  return (
    <div className="im">
      {LINES.map((line, i) => (
        <span key={line} className="fh-mask">
          <span className={i ? "im-line accent" : "im-line"} style={rise(prog(s, 0.2 + i * 0.4, 0.5))}>
            {line}
          </span>
        </span>
      ))}
      {isReal(r.status) ? (
        <div className="im-num" style={{ opacity: prog(s, 1.1, 0.3) }}>
          <b>
            {r.bound} {countUp(r.value, n, 1)}k
          </b>
          <span>tokens saved by catches in one run · 6-agent replay</span>
        </div>
      ) : null}
    </div>
  );
}
