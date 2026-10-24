import { STEPS, type StepId } from "./steps";

/** A slim segmented bar with the step's name, like a checkout's progress. */
export function Progress({ step }: { step: StepId }) {
  const at = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="progress">
      <ol className="progress-bar" aria-label={`Step ${at + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={i < at ? "done" : i === at ? "now" : undefined}
            aria-current={i === at ? "step" : undefined}
          >
            <span className="sr-only">{s.label}</span>
          </li>
        ))}
      </ol>
      <span className="progress-text">
        Step {at + 1} of {STEPS.length} · {STEPS[at]?.label}
      </span>
    </div>
  );
}
