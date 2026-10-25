import "./why.css";
import { MeasuredStrip } from "./measured-strip";
import { ScaleStats } from "./scale-stats";

const COLS = [
  {
    tag: "git",
    big: "4–31%",
    small: false,
    title: "Git only sees it at merge time",
    body: "16% of merges hit textual conflicts, and 4–31% merged clean but then broke the build or tests.",
    src: "Brun et al., ESEC/FSE 2011",
  },
  {
    tag: ".md instructions",
    big: "“deterministic control”",
    small: true,
    title: "A shared file is a suggestion",
    body: "Hooks give “deterministic control … rather than relying on the LLM to choose.” Compliance with agent config files varies by task and over a session.",
    src: "Anthropic, Claude Code docs · arXiv 2605.10039",
  },
  {
    tag: "nudges",
    big: "82%",
    small: false,
    title: "One message at the right moment works",
    body: "One message describing a teammate's concurrent change recovered 82% of failed parallel runs. Verbal feedback lifted coding pass@1 from 80% to 91%.",
    src: "“Passes Alone, Fails Together”, 2026 · Reflexion, NeurIPS 2023",
  },
] as const;

export function Why() {
  return (
    <section id="why">
      <div className="sec-head">
        <div>
          <span className="label">Why not just git or a shared .md file?</span>
          <h2>Both arrive too late, or too politely</h2>
        </div>
        <p>
          Git reports a collision after the work is done. An instructions file hopes the agent reads it. A
          hook reaches the agent at the moment it acts.
        </p>
      </div>
      <div className="why-grid">
        {COLS.map((c) => (
          <article key={c.tag} className="why-col">
            <span className="label">{c.tag}</span>
            <b className={c.small ? "why-big sm" : "why-big"}>{c.big}</b>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
            <small className="src">{c.src}</small>
          </article>
        ))}
      </div>
      <ScaleStats />
      <MeasuredStrip />
    </section>
  );
}
