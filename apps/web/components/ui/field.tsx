import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

/** Label above, control, then one line of hint or the error in its place. */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  mono,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input className={["input", mono ? "mono" : "", className ?? ""].filter(Boolean).join(" ")} {...rest} />
  );
}

export function FormError({ error }: { error: string | null | undefined }) {
  return error ? (
    <p className="field-error" role="alert">
      {error}
    </p>
  ) : null;
}
