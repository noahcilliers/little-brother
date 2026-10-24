import type { ReactNode } from "react";
import { Button, ButtonLink } from "../ui/button";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  back: string | null;
  skip: string;
  /** The primary action: a link onward, or nothing when the step's own form moves on. */
  next?: { href: string; label: string; disabled?: boolean } | null;
};

/** One focused step: title, one line, the work, then Back · I'll do this later · Continue. */
export function WizardCard({ title, description, children, back, skip, next }: Props) {
  return (
    <section className="wizard-card">
      <header>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="wizard-body">{children}</div>
      <footer className="wizard-foot">
        {back ? (
          <ButtonLink href={back} variant="ghost" icon="chevronLeft">
            Back
          </ButtonLink>
        ) : (
          <span />
        )}
        <div className="wizard-foot-end">
          <ButtonLink href={skip} variant="ghost">
            I'll do this later
          </ButtonLink>
          {next ? (
            next.disabled ? (
              <Button variant="primary" disabled>
                {next.label}
              </Button>
            ) : (
              <ButtonLink href={next.href} variant="primary">
                {next.label}
              </ButtonLink>
            )
          ) : null}
        </div>
      </footer>
    </section>
  );
}
