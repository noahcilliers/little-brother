import { prog } from "./film-clock";
import { countUp } from "./film-fx";

export type Stat = {
  lead?: string;
  pre?: string;
  value: number;
  unit: string;
  text: string;
  src: string;
};

/** One sourced number in the row under the problem statement: it counts up as it rises in at `at`. */
export function StatTile({ s, st, at }: { s: number; st: Stat; at: number }) {
  const shown = prog(s, at, 0.35);
  return (
    <section className="hs" style={{ opacity: shown, transform: `translateY(${(1 - shown) * 24}px)` }}>
      <span className="hs-lead">{st.lead ?? " "}</span>
      <span className="hs-num">
        {st.pre}
        {countUp(st.value, prog(s, at, 0.7))}
        {st.unit}
      </span>
      <span className="hs-text">{st.text}</span>
      <span className="hs-src" style={{ opacity: prog(s, at + 0.35, 0.3) }}>
        {st.src}
      </span>
    </section>
  );
}
