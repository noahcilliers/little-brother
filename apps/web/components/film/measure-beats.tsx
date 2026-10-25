import type { Result } from "./benchmarks";
import { prog } from "./film-clock";
import { BigNumber, MBar } from "./measure-parts";

/** One result, full screen: what it measures, the number counting up, its bars if any, and where it's from. */
export function ResultBeat({ t, r }: { t: number; r: Result }) {
  const bars = r.bars ?? [];
  return (
    <>
      <h3 className="ms-label">{r.label}</h3>
      <BigNumber t={t} value={r.value} unit={r.unit} />
      {bars.length > 0 ? (
        <div className="ms-bars">
          {bars.map((b, i) => (
            <MBar
              key={b.name}
              t={t}
              delay={0.35 + i * 0.12}
              name={b.name}
              value={b.value}
              max={r.max ?? 100}
              shown={b.shown}
              accent={b.accent}
            />
          ))}
        </div>
      ) : null}
      <p className="ms-note" style={{ opacity: prog(t, 0.6 + bars.length * 0.12, 0.35) }}>
        {r.note}
      </p>
    </>
  );
}
