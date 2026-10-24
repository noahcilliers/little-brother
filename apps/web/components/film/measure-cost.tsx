import { BENCH } from "./benchmarks";
import { prog } from "./film-clock";
import { countUp } from "./film-fx";
import { BigNumber, MBar } from "./measure-parts";

// Tokens and cost, Little Brother off vs on. The controlled run is pending; the replay estimate is measured.

export function TokensBeat({ t }: { t: number }) {
  const b = BENCH.tokensControlled;
  const r = BENCH.tokensReplay;
  return (
    <>
      <h3 className="ms-label">{b.label}</h3>
      <BigNumber t={t} bound={b.bound} value={b.value} unit={b.unit} status={b.status} />
      <div className="ms-bars">
        {b.baselines.map((x, i) => (
          <MBar
            key={x.name}
            t={t}
            delay={0.6 + i * 0.2}
            name={`Little Brother ${x.name}`}
            value={x.value}
            max={100}
            shown={`${x.value}`}
            accent={x.name === "on"}
          />
        ))}
      </div>
      <div className="ms-measured" style={{ opacity: prog(t, 1.3, 0.3) }}>
        <b>
          {r.bound}
          {countUp(r.value, prog(t, 1.3, 0.8), 1)}k
        </b>
        <span>{r.label}</span>
      </div>
    </>
  );
}

export function CostBeat({ t }: { t: number }) {
  const b = BENCH.cost;
  const [off, on] = b.baselines;
  return (
    <>
      <h3 className="ms-label">{b.label}</h3>
      <BigNumber t={t} bound={b.bound} value={b.value} unit={b.unit} status={b.status} />
      <div className="ms-bars">
        {off ? (
          <MBar
            t={t}
            delay={0.6}
            name="off"
            value={off.value}
            max={off.value}
            shown={`$${off.value.toFixed(2)}`}
          />
        ) : null}
        {on && off ? (
          <MBar
            t={t}
            delay={0.8}
            name="on"
            value={on.value}
            max={off.value}
            shown={`$${on.value.toFixed(2)}`}
            accent
          />
        ) : null}
      </div>
      <p className="ms-note" style={{ opacity: prog(t, 1.3, 0.3) }}>
        The judge only runs on pairs the rules can't settle.
      </p>
    </>
  );
}
