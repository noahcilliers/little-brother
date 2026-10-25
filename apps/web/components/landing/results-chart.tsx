import { BROKEN_MERGES } from "./results-data";

/** Off vs on per suite as paired bars; the bars grow in when the chart scrolls into view (CSS, data-play). */
export function ResultsChart() {
  return (
    <figure className="rs-chart">
      <figcaption>
        Runs whose merge broke: a conflict, or a teammate's tests failing
        <span className="rs-key">
          <i className="off" /> off <i className="on" /> on
        </span>
      </figcaption>
      {BROKEN_MERGES.map((r) => (
        <div key={r.suite} className="rs-row">
          <span className="rs-name">
            {r.suite}
            <small>{r.runs} runs</small>
          </span>
          <span className="rs-bars">
            <span className="rs-bar off" style={{ width: `${r.off}%` }}>
              <b>{r.off}%</b>
            </span>
            <span className="rs-bar on" style={{ width: `${Math.max(r.on, 3)}%` }}>
              <b>{r.on}%</b>
            </span>
          </span>
        </div>
      ))}
    </figure>
  );
}
