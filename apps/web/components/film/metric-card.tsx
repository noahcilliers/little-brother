import type { ReactNode } from "react";
import { clamp01, easeOut } from "./film-clock";

// The frame every metric card shares: a title, the chart, and where the number comes from.

export function MetricCard({
  title,
  source,
  p,
  children,
}: {
  title: string;
  source: string;
  p: number;
  children: ReactNode;
}) {
  const e = easeOut(clamp01(p / 0.5));
  return (
    <section className="mc" style={{ opacity: e, transform: `translateY(${(1 - e) * 24}px)` }}>
      <h3>{title}</h3>
      <div className="mc-body">{children}</div>
      <small className="mc-src">{source}</small>
    </section>
  );
}

/** A horizontal bar that grows from 0 to `value / max`, with its label and count. */
export function Bar({
  label,
  value,
  max,
  p,
  shown,
  tag,
  hatch = false,
}: {
  label: string;
  value: number;
  max: number;
  p: number;
  shown: string;
  tag?: string;
  hatch?: boolean;
}) {
  const grow = easeOut(clamp01(p));
  return (
    <div className="mc-bar">
      <span className="mc-bar-label">
        {label}
        {tag ? <em>{tag}</em> : null}
      </span>
      <span className="mc-track">
        <i className={hatch ? "hatch" : ""} style={{ width: `${(value / max) * 100 * grow}%` }} />
      </span>
      <b>{shown}</b>
    </div>
  );
}

/** Starts a card's local clock `delay` seconds after the card appears. */
export const after = (p: number, delay: number, dur = 0.8) => clamp01((p - delay) / dur);
