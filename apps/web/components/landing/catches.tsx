const CATCHES = [
  {
    type: "duplicate",
    title: "Two agents build the same thing",
    body: "One copy gets thrown away at merge, along with the tokens and time that produced it.",
    sig: "EDIT db.users  db/schema/users.ts\n     ✕ owned by noah · agent active",
    outcome: "Blocked at the edit, pointed to the existing work.",
  },
  {
    type: "stale",
    title: "An agent retries a path that already failed",
    body: "A teammate's agent spent nine minutes proving it doesn't work. Without shared memory, the next agent spends nine more.",
    sig: "PLAN api.cors  add CORS middleware\n     ⚠ failed 10:21 · use vite proxy",
    outcome: "Warned before the first edit, with what worked.",
  },
  {
    type: "conflict",
    title: "Two agents build incompatible versions",
    body: "Each passes its own tests. Integration fails after both are pushed and the work is already done.",
    sig: "DECIDE auth.mech = jwt-bearer\n     ≠ cookie-session (joshua)",
    outcome: "Edits on that topic pause; the owner picks one.",
  },
];

export function Catches() {
  return (
    <section id="catches">
      <div className="sec-head">
        <div>
          <span className="label">What it catches</span>
          <h2>Three ways teams waste agent work</h2>
        </div>
        <p>Every agent action is classified as one of four event types. Normal work stays silent.</p>
      </div>
      <div className="tiles three">
        {CATCHES.map((c) => (
          <article key={c.type} className="tile catch">
            <span>
              <span className={`vt ${c.type}`}>{c.type}</span>
            </span>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
            <div className="sig">{c.sig}</div>
            <p className="outcome">{c.outcome}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
