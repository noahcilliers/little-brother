import "./classifier-compare.css";
import type { ClassifierBench } from "@lb/core";

const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const count = (n: number) => n.toLocaleString("en-US");
const latency = (ms: number | null) =>
  ms === null ? "not timed" : ms >= 1000 ? `~${ms / 1000} s` : `${ms} ms`;
const pretty = (relation: string) => relation.replace(/_/g, " ");

/**
 * Our pair model next to the LLM judge, on the pairs no rule settles. It is not better at everything: it
 * answers only when confident and hands the rest to the judge, so the honest comparison is coverage,
 * accuracy on what it answers, speed and cost.
 */
export function ClassifierCompare({ bench }: { bench: ClassifierBench }) {
  const settled = bench.relations.filter((r) => r.settled > 0).sort((a, b) => b.settled - a.settled);
  const abstains = bench.relations.filter((r) => r.settled === 0).map((r) => pretty(r.relation));
  const judgeShare = 1 - bench.settledShare;
  return (
    <div className="tl-cls">
      <div
        className="tl-split"
        role="img"
        aria-label={`${pct(bench.settledShare)} settled by the pair model`}
      >
        <span style={{ flexGrow: bench.settledShare }}>pair model · {pct(bench.settledShare)}</span>
        <span style={{ flexGrow: judgeShare }}>LLM judge · {pct(judgeShare)}</span>
      </div>
      <table className="tl-vs">
        <thead>
          <tr>
            <th scope="col">
              <span className="label">{count(bench.openPairs)} open pairs</span>
            </th>
            <th scope="col">Pair model (ours)</th>
            <th scope="col">LLM judge (Gemini)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Answers</th>
            <td>
              {count(bench.settledByModel)} pairs, the confident ones ({pct(bench.settledShare)})
            </td>
            <td>the other {pct(judgeShare)}: the hard ones</td>
          </tr>
          <tr>
            <th scope="row">Accuracy</th>
            <td>{pct(bench.settledAccuracy, 1)} on what it answers</td>
            <td>not scored against these labels yet</td>
          </tr>
          <tr>
            <th scope="row">Time per pair</th>
            <td>{latency(bench.modelMsPerPair)}</td>
            <td>{latency(bench.judgeMsPerPair)}</td>
          </tr>
          <tr>
            <th scope="row">Cost per pair</th>
            <td>$0, runs inside Convex</td>
            <td>one paid model call</td>
          </tr>
        </tbody>
      </table>
      <ul className="tl-rel">
        {settled.map((r) => (
          <li key={r.relation}>
            <span>{pretty(r.relation)}</span>
            <b>{count(r.settled)} settled</b>
            <small>{r.settledPrecision === null ? "–" : `${pct(r.settledPrecision)} right`}</small>
          </li>
        ))}
      </ul>
      <p className="tl-note">
        Always handed to the judge: {abstains.join(", ")}. Pair model {bench.version}:{" "}
        {count(bench.goldPairs)} gold-labelled pairs from {count(bench.groups)} repositories and eval cases,
        scored out-of-fold. Model time is inference in an offline replay; judge time is the median call in our
        live evals.
      </p>
    </div>
  );
}
