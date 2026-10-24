import type { ReactNode } from "react";
import { type Status, TAG } from "./benchmarks";
import { clamp01, easeOut, lerp, prog } from "./film-clock";
import { countUp } from "./film-fx";

// Building blocks for the full-screen benchmark beats: the zoom in and out, the big number, the status tag, bars.

export const BEAT_S = 2.85;

/** One full-screen beat on its own clock t: zooms in from close, holds, zooms out and away. */
export function Beat({ t, children }: { t: number; children: ReactNode }) {
  if (t < 0 || t > BEAT_S) return null;
  const pin = easeOut(clamp01(t / 0.45));
  const pout = easeOut(clamp01((t - BEAT_S + 0.4) / 0.4));
  const scale = lerp(1.4, 1, pin) * lerp(1, 0.82, pout);
  return (
    <div
      className="ms-beat"
      style={{
        opacity: pin * (1 - pout),
        transform: `scale(${scale})`,
        filter: `blur(${(1 - pin) * 10 + pout * 6}px)`,
      }}
    >
      {children}
    </div>
  );
}

export function Tag({ status }: { status: Status }) {
  const text = TAG[status];
  return text ? <em className={`ms-tag ${status}`}>{text}</em> : null;
}

/** The headline number, counting up; `decimals` for values like 8.5. */
export function BigNumber({
  t,
  bound = "",
  value,
  unit,
  status,
  decimals = 0,
}: {
  t: number;
  bound?: string;
  value: number;
  unit: string;
  status: Status;
  decimals?: number;
}) {
  return (
    <div className="ms-big">
      <b>
        {bound}
        {countUp(value, prog(t, 0.2, 1), decimals)}
        <small>{unit}</small>
      </b>
      <Tag status={status} />
    </div>
  );
}

/** A labelled horizontal bar growing to value/max. */
export function MBar({
  t,
  delay,
  name,
  value,
  max,
  shown,
  accent = false,
}: {
  t: number;
  delay: number;
  name: string;
  value: number;
  max: number;
  shown: string;
  accent?: boolean;
}) {
  const g = prog(t, delay, 0.7);
  return (
    <div className="ms-bar" style={{ opacity: prog(t, delay - 0.1, 0.3) }}>
      <span>{name}</span>
      <i className="ms-track">
        <i
          className={accent ? "ms-fill accent" : "ms-fill"}
          style={{ width: `${(value / max) * 100 * g}%` }}
        />
      </i>
      <b>{shown}</b>
    </div>
  );
}
