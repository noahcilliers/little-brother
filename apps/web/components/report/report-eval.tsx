import { SUITES } from "./report-data";
import { Section, Src, Table } from "./report-parts";

const METRICS: [name: string, def: string][] = [
  ["Precision", "flags that matched a clash that really happened ÷ all flags"],
  ["Recall", "planted clashes that materialised and were flagged ÷ those that materialised"],
  ["Pre-edit rate", "catches that reached the later agent before its first edit on the clashing work"],
  [
    "Interference (Δblind)",
    "both tasks pass on their own branches, but a teammate's tests fail after a clean merge",
  ],
  ["Merged success", "the merged branch passes every task's tests after the merge-and-fix step"],
  [
    "Tokens and $",
    "new tokens (input + output + cache writes) and Claude Code's cost estimate per run, fix step included",
  ],
];

// biome-ignore format: tabular data
const FIXES: [title: string, what: string][] = [
  ["Deny once means once", "The hook got the open catch back and denied every retry on its stored action; agents told they wouldn't be stopped again were, and gave up."],
  ["Calls inside f-strings", "Masking whole Python f-strings hid calls like f\"{slugify(name)}\", so a signature change never met its caller."],
  ["Say how to finish", "Headless agents read a bare denial as \"stop the task\". Every denial now says it isn't a stop and what to do next."],
  ["Interface clashes have two fixes", "The caller writes against the new interface, the changer keeps the old one working; the side found later is held at Stop."],
  ["Hook timeout", "A cold start plus a slow backend crossed Claude Code's 3 s limit and dropped the deny; the limit is now 8 s."],
];

export function ReportEval() {
  return (
    <Section id="evaluation" n={4} title="Evaluation">
      <p>
        Protocol: Sonnet agents (Claude Code, headless) run the same task twice, Little Brother off and on,
        each on its own branches; a merge-and-fix step then merges the branches and gives one agent the chance
        to repair the result. Ground truth comes from git and the tests, never from an LLM. These are pilot
        runs: samples are small and every table names its run count.
      </p>
      <Table head={["Metric", "Definition"]} rows={METRICS} />
      {SUITES.map((s) => (
        <div key={s.id} id={`suite-${s.id}`} className="rp-suite">
          <h3>
            {s.name} <small className="rp-sample">pilot · {s.runs} runs</small>
          </h3>
          <p>
            {s.what} <Src k={s.src} />
          </p>
          <Table head={["", "Little Brother off", "Little Brother on"]} rows={s.rows} />
        </div>
      ))}
      <p>
        Honest costs: on STALE-bench, agents that were warned solved their own task alone less often (88% →
        72% and 94% → 66%), and the hook round trip measured on the larger suite (p95 1.4 s, Node start-up
        included) misses the 150 ms edit-path target. <Src k="stale2" />
      </p>
      <h3>Haiku agents, four arms</h3>
      <p>
        On STALE-bench with Haiku agents, a shared mailbox left 100% of merges broken, the same as no
        coordination (20 runs each); a hand-written note about the change up front brought it to 45%. After
        the fixes below, Little Brother caught 46 of 48 planted interface clashes with none mislabelled, but
        once both agents finish their tasks most merges still break: the caller tends to keep the name its own
        branch has. Every rerun and its numbers are in the eval report. <Src k="haiku" />
      </p>
      <h3>What the runs changed</h3>
      <ul className="rp-list">
        {FIXES.map(([title, what]) => (
          <li key={title}>
            <b>{title}.</b> {what}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ReportNext() {
  return (
    <Section id="next" n={5} title="What's next">
      <ul className="rp-list">
        <li>More labelled data from live runs: every decision and every merge outcome becomes a label.</li>
        <li>A fine-tuned cross-encoder for the pairs the tree model leaves to the judge.</li>
        <li>
          An intervention-value model, so the choice between deny, hint and nothing weighs what each one
          saves.
        </li>
      </ul>
    </Section>
  );
}
