import type { ReactNode } from "react";

/** Loading, not-found and gate states share one quiet centred block. */
export function PageState({
  title,
  children,
  loading,
}: {
  title: string;
  children?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="page-state" aria-busy={loading || undefined}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      <b>{title}</b>
      {children}
    </div>
  );
}
