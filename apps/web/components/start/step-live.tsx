import type { Progress } from "@/lib/api";
import { Step, type StepState } from "./step";

const CHECKS = [
  ["sessionStart", "SessionStart received", "Start Claude Code in any repo."],
  ["prompt", "First prompt", "Ask it for anything."],
  ["edit", "First edit", "Let it change a file."],
] as const;

/** Turns green as this member's first hook events reach the backend (a live Convex query). */
export function StepLive({ state, progress }: { state: StepState; progress: Progress | undefined }) {
  return (
    <Step id="live" n={4} title="Watch the first events arrive" state={state}>
      <ul className="checks">
        {CHECKS.map(([key, label, hint]) => {
          const done = progress?.[key] ?? false;
          return (
            <li key={key} className={done ? "ok" : ""}>
              <i aria-hidden="true">{done ? "✓" : ""}</i>
              <b>{label}</b>
              <span>{done ? "received" : progress ? `waiting · ${hint}` : hint}</span>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <a className={state === "done" ? "btn inv" : "btn"} href="/app">
          Open dashboard
        </a>
      </div>
    </Step>
  );
}
