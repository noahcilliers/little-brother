import type { ReactNode } from "react";
import { Icon } from "./icon";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "solid";

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

/** A small round status light, always next to text that says the same thing; `pulse` for live. */
export function Dot({ tone = "neutral", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return <span className={`dot dot-${tone}${pulse ? " dot-pulse" : ""}`} aria-hidden="true" />;
}

/** A live check that flips from waiting to done, for onboarding steps that wait on the laptop. */
export function LiveCheck({ done, waiting, ok }: { done: boolean; waiting: string; ok: string }) {
  return (
    <p className={done ? "live-check done" : "live-check"} aria-live="polite">
      {done ? <Icon name="check" size={14} /> : <span className="spinner" aria-hidden="true" />}
      {done ? ok : waiting}
    </p>
  );
}
