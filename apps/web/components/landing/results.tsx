import "./results.css";
import { PlayOnView } from "./play-on-view";
import { ResultsChart } from "./results-chart";
import { HEADLINES } from "./results-data";

/** Measured impact, right after the film: headline cards, one off-vs-on chart, and how it was measured. */
export function Results() {
  return (
    <section id="results">
      <div className="sec-head">
        <div>
          <span className="label">Results</span>
          <h2>Cheaper runs, cleaner merges</h2>
        </div>
        <p>
          How we measured: Sonnet agents on the same tasks with Little Brother off and on, then a
          merge-and-fix step. Ground truth comes from git and the tests, never from an LLM.
        </p>
      </div>
      <div className="rs-cards">
        {HEADLINES.map((h) => (
          <article key={h.big} className="rs-card">
            <b>{h.big}</b>
            <span>{h.what}</span>
            <small>{h.sample}</small>
          </article>
        ))}
      </div>
      <PlayOnView className="rs-play">
        <ResultsChart />
      </PlayOnView>
      <p className="rs-foot">
        Pilot runs: small samples, reported with every number.{" "}
        <a href="/report">Read the technical report →</a>
      </p>
    </section>
  );
}
