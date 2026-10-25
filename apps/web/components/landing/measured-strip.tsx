import { EVALS_URL, STRIP } from "./results-data";

/** The four strongest measured numbers, next to the sourced problem stats. Styles in results.css. */
export function MeasuredStrip() {
  return (
    <div className="ms-strip">
      <div>
        <span className="label">Measured</span>
        <a href={EVALS_URL}>evals →</a>
      </div>
      {STRIP.map((h) => (
        <div key={h.big}>
          <b>{h.big}</b>
          <span>{h.what}</span>
          <small>{h.sample}</small>
        </div>
      ))}
    </div>
  );
}
