import type { ReactNode } from "react";

/** Loading, not-found and gate states share one quiet card. */
export function PageState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-state">
      <b>{title}</b>
      {children}
    </div>
  );
}
