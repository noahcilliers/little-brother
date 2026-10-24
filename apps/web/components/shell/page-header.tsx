import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  /** One line under or beside the title: status, code, counts. */
  meta?: ReactNode;
  /** At most two primary actions. */
  actions?: ReactNode;
  /** Sub-navigation (tabs) that sits on the header's bottom edge. */
  tabs?: ReactNode;
};

/** The thin header every page starts with. */
export function PageHeader({ title, meta, actions, tabs }: Props) {
  return (
    <header className={tabs ? "page-header has-tabs" : "page-header"}>
      <div className="page-header-row">
        <div className="page-title">
          <h1>{title}</h1>
          {meta ? <div className="page-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      {tabs}
    </header>
  );
}
