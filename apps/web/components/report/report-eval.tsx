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

// From commit a8e631e.
// biome-ignore format: tabular data
const FIXES: [title: string, what: string][] = [
  ["Adapt, don't stop", "Interface changes (R4/R5/R12) warn with the new interface instead of blocking; stopping made agents abandon their own task on STALE-bench."],
  ["Runner crashes are failures", "A test run that dies before running (missing dependency, import error) counts as failed, so its lesson is learned; the jsdom stale case was missed 4/4."],
  ["Finished teammates still count", "Agents that already finished stay candidates within the active window; ordering cases were missed 3/3 when the author had gone offline."],
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
      <h3>What the pilots changed</h3>
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
