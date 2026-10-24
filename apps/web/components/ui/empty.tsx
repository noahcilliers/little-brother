import type { ReactNode } from "react";

/** Designed empty state: what will appear here, in the signature form it will appear in. */
export function Empty({ title, sample, children }: { title: string; sample?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="label">{title}</span>
      {sample ? <div className="sig">{sample}</div> : null}
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <div className="empty">
      <span className="label">loading {what}…</span>
    </div>
  );
}
