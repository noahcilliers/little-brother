import { Section } from "./report-parts";

export const TOC: [id: string, title: string][] = [
  ["problem", "The problem"],
  ["architecture", "Architecture"],
  ["classifier", "The classifier"],
  ["evaluation", "Evaluation"],
  ["next", "What's next"],
];

const PROBLEM: [big: string, what: string, src: string][] = [
  ["42%", "of committed code is now written by AI", "Sonar, State of Code 2026 (1,100+ developers)"],
  [
    "~5×",
    "the tokens a human uses, 70–85% of it re-reading context already seen",
    "OpenRouter / Futurum, Aug 2026; a16z × OpenRouter 100T-token study",
  ],
  [
    "~30%",
    "lower success for teams of coding agents than one agent alone; 42% of their failures misjudge the partner",
    "CooperBench, Jan 2026",
  ],
  ["4–31%", "of merges were textually clean but broke the build or tests", "Brun et al., ESEC/FSE 2011"],
];

const PIPELINE = [
  "Claude Code hooks report every prompt and tool call",
  "Local normalisation on the laptop: touched files and symbols (TypeScript and Python), the repo's import graph",
  "Candidate pairs: other agents' recent work that overlaps",
  "Rules R1–R12 settle the clear cases in milliseconds",
  "A learned pair model settles most of the rest in well under a millisecond",
  "The LLM judge sees only what the model is unsure of, off the edit path",
  "A cost-aware intervention: deny, hint or nothing, depending on what acting is worth",
  "One alert per catch, delivered into the affected sessions",
];

export function ReportIntro() {
  return (
    <>
      <Section id="problem" n={1} title="The problem">
        <p>
          Teams now run several coding agents at once, each in its own session with no view of the others.
          They duplicate work, retry paths a teammate already proved fail, and make changes that pass alone
          and break together. Git sees this only at merge time, and only when the text collides.
        </p>
        <div className="rp-stats">
          {PROBLEM.map(([big, what, src]) => (
            <div key={big}>
              <b>{big}</b>
              <span>{what}</span>
              <small>{src}</small>
            </div>
          ))}
        </div>
      </Section>
      <Section id="architecture" n={2} title="Architecture">
        <p>
          Little Brother is a coordination layer: a Claude Code plugin on every laptop and one shared backend.
          Its design rule is cost: the expensive check runs only when the cheap ones can't decide.
        </p>
        <ol className="rp-flow">
          {PIPELINE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>
    </>
  );
}
