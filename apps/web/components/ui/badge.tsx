import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Event type or delivery state, shown by line style and inversion rather than color. */
export function Badge({ kind, title, children }: { kind: string; title?: string; children?: ReactNode }) {
  return (
    <span className={clsx("vt", kind)} title={title}>
      {children ?? kind}
    </span>
  );
}

export function StateBadge({ state }: { state: "queued" | "delivered" | "acked" | "applied" }) {
  return <span className={clsx("vt", `state-${state}`)}>{state}</span>;
}
