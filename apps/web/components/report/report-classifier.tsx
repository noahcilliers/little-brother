import { CLASSIFIER, LEARNING_CURVE } from "@/components/film/classifier-results";
import { CurveChart } from "./curve-chart";
import { ARCHITECTURES, RELATIONS } from "./report-data";
import { Section, Src, Table } from "./report-parts";

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function ReportClassifier() {
  const c = CLASSIFIER;
  return (
    <Section id="classifier" n={3} title="The classifier">
      <h3>Data</h3>
      <p>
        {c.pairs.toLocaleString("en-US")} real labelled pairs: agent pull requests from AgenticFlict (each PR
        against the base branch's drift, merge-simulated) and STALE-bench Django pairs.{" "}
        {c.gold.toLocaleString("en-US")} carry gold labels (ground truth from the merge or tests, weight 1);
        the rest are teacher labels from rules or the judge (weight 0.3). <Src k="model" />
      </p>
      <h3>Model</h3>
      <p>
        {c.features} features per pair (paths, symbols, import-graph distance, intent overlap, failure
        memory). A gradient-boosted tree and a logistic regression are compared on out-of-fold predictions
        grouped by repository, so no repository is ever on both sides of a split; isotonic calibration and
        per-relation settle thresholds are fit on the same out-of-fold predictions.
      </p>
      <h3>Results</h3>
      <ul className="rp-list">
        <li>
          Of the gold pairs no rule settles, the model settles <b>{c.settledShare}%</b> at{" "}
          <b>{c.settledAccuracy}%</b> accuracy, so they never reach the LLM judge.
        </li>
        <li>
          Blocking precision <b>{c.blockingPrecision.model}</b> against <b>{c.blockingPrecision.rules}</b> for
          rules alone.
        </li>
        <li>
          Calibration error (ECE) <b>{c.ece.raw}</b> → <b>{c.ece.calibrated}</b>;{" "}
          <b>{c.latency.modelMs} ms</b> per pair against ~{c.latency.judgeS} s for a judge call.
        </li>
      </ul>
      <Table head={["Relation", "Precision", "Recall", "F1", "Support"]} rows={RELATIONS} />
      <Table
        head={[
          "Architecture",
          "Blocking precision",
          "Blocking recall",
          "Judge calls / pair",
          "Latency / pair",
        ]}
        rows={ARCHITECTURES}
      />
      <h3>Learning curve</h3>
      <p>
        The same grouped CV, training on 10–100% of each fold's rows (stratified, 3 seeds), always scored on
        the full held-out fold. Settling coverage reaches {pct(LEARNING_CURVE[1]?.settled ?? 0)} by a quarter
        of the data; blocking precision rises to ~0.79 by half and is flat after that, so more of the same
        data will not move it: new kinds of labels will. <Src k="curve" />
      </p>
      <CurveChart />
      <h3>Limits</h3>
      <ul className="rp-list">
        <li>
          No real positives yet for duplicate, stale or ordering pairs: those relations are never settled by
          the model and go to the judge.
        </li>
        <li>
          Semantic conflicts do not yet generalise across repositories (recall 0.00 out of fold on 37 pairs).
        </li>
        <li>
          Macro-F1 is 0.52 because of those empty classes; the model is used only where its thresholds were
          verified.
        </li>
      </ul>
    </Section>
  );
}
