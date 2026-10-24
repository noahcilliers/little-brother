import { joinSlash } from "@/lib/invite";

const STEPS = [
  ["Create a room", "One per team or project. Share its invite link so teammates can join."],
  ["Start a session", "A session is one piece of work you want coordinated. It gets a short join code."],
  ["Join from Claude Code", `Each teammate runs ${joinSlash("<code>")} in their Claude Code session.`],
] as const;

/** The three steps from nothing to a live board, shown until the first room exists. */
export function WorkflowSteps() {
  return (
    <ol className="workflow">
      {STEPS.map(([title, body], i) => (
        <li key={title}>
          <span className="workflow-n">{String(i + 1).padStart(2, "0")}</span>
          <b>{title}</b>
          <p>{body}</p>
        </li>
      ))}
    </ol>
  );
}
