import "./results.css";
import { PlayOnView } from "./play-on-view";
import { ResultsChart } from "./results-chart";
import { HEADLINES } from "./results-data";

/** Measured impact, right after the film: headline cards and one off-vs-on chart. */
export function Results() {
  return (
    <section id="results">
      <div className="sec-head">
        <h2>Cheaper runs, cleaner merges</h2>
        <p>Sonnet agents on the same tasks, Little Brother off vs on. Graded by git and the tests.</p>
      </div>
      <div className="rs-cards">
        {HEADLINES.map((h) => (
          <article key={h.big} className="rs-card">
            <b>{h.big}</b>
            <span>{h.what}</span>
          </article>
        ))}
      </div>
      <PlayOnView className="rs-play">
        <ResultsChart />
      </PlayOnView>
      <p className="rs-foot">
        Pilot runs, small samples. <a href="/report">Technical report →</a>{" "}
        <a href="/benchmarks">Live benchmark runs →</a>
      </p>
    </section>
  );
}
