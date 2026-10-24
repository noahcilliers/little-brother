const STEPS = [
  ["01 · observe", "Hooks log the event", "Every prompt, edit and command becomes an event and a node: intent, action or knowledge.", "PreToolUse · Write · users.ts"],
  ["02 · classify", "Cheapest check first", "Rules in milliseconds, then similarity against past work, then an LLM judge only for close calls.", "rules → similarity → judge"],
  ["03 · respond", "Steer in the same step", "Deny, warn or stay silent in the hook response. Affected teammates' agents get it pushed into their session.", 'permissionDecision: "deny"'],
  ["04 · learn", "Every verdict is graded", "Confirmed or dismissed verdicts tune thresholds, examples and rules, so checks get faster and more precise.", "confirmed · false_positive"],
] as const;

const FACTS = [
  ["<150 ms", "budget for the check on every edit"],
  ["4", "event types: duplicate, stale, conflict, normal"],
  ["0", "changes to how your team prompts"],
  ["1", "install per machine, any Claude account"],
] as const;

export function How() {
  return (
    <section id="how">
      <div className="sec-head">
        <div>
          <span className="label">How it works</span>
          <h2>One loop on every action</h2>
        </div>
        <p>No new workflow for developers. The agents keep their prompts; the hooks do the checking.</p>
      </div>
      <div className="tiles four">
        {STEPS.map(([n, title, body, code]) => (
          <div key={n} className="tile step">
            <span className="n">{n}</span>
            <h3>{title}</h3>
            <p>{body}</p>
            <code>{code}</code>
          </div>
        ))}
      </div>
      <div className="tiles facts">
        {FACTS.map(([big, small]) => (
          <div key={small} className="tile fact">
            <b>{big}</b>
            <span>{small}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
