import type { ReactNode } from "react";

export type StepState = "done" | "current" | "waiting";

type Props = { id: string; n: number; title: string; state: StepState; children: ReactNode };

/** One tile of the /start stepper. */
export function Step({ id, n, title, state, children }: Props) {
  return (
    <div
      className={`tile step-tile ${state}`}
      id={id}
      aria-current={state === "current" ? "step" : undefined}
    >
      <div className="step-head">
        <span className="step-n">{String(n).padStart(2, "0")}</span>
        <h2>{title}</h2>
        <span className="step-state">{state === "done" ? "done" : state === "current" ? "now" : "next"}</span>
      </div>
      <div className="step-body">{children}</div>
    </div>
  );
}

/** ConvexError carries the user-facing message in `data`. */
export function errorText(err: unknown): string {
  if (err && typeof err === "object" && "data" in err && typeof err.data === "string") return err.data;
  return "Something went wrong. Try again.";
}
