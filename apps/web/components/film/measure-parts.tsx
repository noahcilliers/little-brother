import type { ReactNode } from "react";
import { clamp01, easeOut, lerp, prog } from "./film-clock";
import { countUp } from "./film-fx";

// Building blocks for the full-screen result beats: the zoom in and out, the big number, bars.

/** One full-screen beat on its own clock t, `len` seconds long: zooms in from close, holds, zooms out and away. */
export function Beat({ t, len, children }: { t: number; len: number; children: ReactNode }) {
  if (t < 0 || t > len) return null;
  const pin = easeOut(clamp01(t / 0.45));
  const pout = easeOut(clamp01((t - len + 0.4) / 0.4));
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

/** The headline number, counting up. */
export function BigNumber({ t, value, unit }: { t: number; value: number; unit: string }) {
  return (
    <div className="ms-big">
      <b>
        {countUp(value, prog(t, 0.2, 1))}
        <small>{unit}</small>
      </b>
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
