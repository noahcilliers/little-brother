import "./how-strip.css";
import { PlayOnView } from "./play-on-view";

const STEPS = [
  {
    title: "Hook",
    body: "Claude Code hooks fire on every prompt, edit and command in a joined session.",
    code: "PreToolUse · Write",
  },
  {
    title: "Normalize on your laptop",
    body: "The lb connector turns raw tool calls into files, symbols and topics before anything is sent.",
    code: "users.ts → db.users",
  },
  {
    title: "Rules ≤ 150 ms + async LLM judge",
    body: "Tier-0 rules and stored verdicts answer inline. Embeddings and the judge run in scheduled actions.",
    code: "rules → similarity → judge",
  },
  {
    title: "Nudge the agent",
    body: "A deny with a reason, extra context on the next turn, or a channel push into a teammate's session.",
    code: 'permissionDecision: "deny"',
  },
] as const;

export function HowStrip() {
  return (
    <section id="how">
      <div className="sec-head">
        <div>
          <span className="label">How it works</span>
          <h2>From hook to nudge, on every action</h2>
        </div>
        <p>No new workflow. Developers keep prompting the way they do; the hooks do the checking.</p>
      </div>
      <PlayOnView className="how-strip">
        <div className="how-line" aria-hidden="true">
          <i />
        </div>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title} className={`hs${i}`}>
              <span className="node">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <code>{s.code}</code>
            </li>
          ))}
        </ol>
      </PlayOnView>
      <p className="how-learn">
        <span className="label">then it learns</span>
        Failed runs are distilled into lessons, your decisions become labels, the judge retrieves past
        verdicts as examples, and thresholds recalibrate.
      </p>
    </section>
  );
}
