import type { ReactNode } from "react";

/** A titled block of a settings-style page: label on top, content in a bordered card. */
export function Section({
  title,
  description,
  actions,
  danger,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={danger ? "section danger" : "section"}>
      <div className="section-body">
        <h2>{title}</h2>
        {description ? <p className="section-desc">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="section-foot">{actions}</div> : null}
    </section>
  );
}
