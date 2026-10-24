import { prog } from "./film-clock";
import { countUp, rise } from "./film-fx";

export type Stat = {
  from: number;
  to: number;
  lead?: string;
  pre?: string;
  value: number;
  unit: string;
  text: string;
  note?: string;
  src: string;
};

/** One big number per beat: it counts up as it rises in, its claim and source follow, then it all leaves upward. */
export function HookStat({ s, st }: { s: number; st: Stat }) {
  if (s < st.from - 0.05 || s > st.to + 0.4) return null;
  const out = prog(s, st.to, 0.35);
  const n = prog(s, st.from, 1.1);
  return (
    <div className="hs" style={{ opacity: 1 - out, transform: `translateY(${-out * 50}px)` }}>
      {st.lead ? (
        <span className="hs-lead" style={{ opacity: prog(s, st.from, 0.3) }}>
          {st.lead}
        </span>
      ) : null}
      <span className="fh-mask">
        <span className="hs-num" style={rise(prog(s, st.from, 0.45))}>
          {st.pre}
          {countUp(st.value, n)}
          {st.unit}
        </span>
      </span>
      <span className="fh-mask">
        <span className="hs-text" style={rise(prog(s, st.from + 0.25, 0.45))}>
          {st.text}
        </span>
      </span>
      {st.note ? (
        <span className="hs-note" style={{ opacity: prog(s, st.from + 0.9, 0.4) }}>
          {st.note}
        </span>
      ) : null}
      <span className="hs-src" style={{ opacity: prog(s, st.from + 0.6, 0.4) }}>
        {st.src}
      </span>
    </div>
  );
}
