import "./pair-model.css";
import "./pair-model-motion.css";
import { PlayOnView } from "../play-on-view";
import { PairModelSvg } from "./pair-model-svg";

// Numbers from scripts/classifier/results/2026-10-24-v2.md (out-of-fold, grouped by repository).
const STATS: [value: string, label: string][] = [
  ["633 / 2,291", "open pairs settled without the judge"],
  ["95.6%", "accurate on the pairs it settles"],
  ["4,166", "labelled pairs from 408 repos"],
];

/** Our own classifier between the rules and the LLM judge, animated while on screen. */
export function PairModel() {
  return (
    <section id="model">
      <div className="sec-head">
        <h2>Our model decides the sure pairs in milliseconds</h2>
      </div>
      <PlayOnView className="pm-card">
        <PairModelSvg />
      </PlayOnView>
      <ul className="pm-stats">
        {STATS.map(([value, label]) => (
          <li key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
