import type { EvalSummary } from "@lb/core";
import { armName, pct, usd } from "@/lib/bench-format";
import { kTokens } from "@/lib/format";

/** Detection only means something with Little Brother on; the off arm has nothing to catch with. */
function detection(s: EvalSummary): string {
  if (s.arm !== "on" || s.expected === 0) return "–";
  return `${s.caught} caught · ${s.expected - s.caught} missed`;
}

/** One row per arm of a batch: the off-vs-on comparison the landing's chart is drawn from. */
export function ArmTable({ arms }: { arms: EvalSummary[] }) {
  if (!arms.length) return <p className="bm-empty">Waiting for the first graded run.</p>;
  return (
    <div className="bm-table-wrap">
      <table className="bm-table">
        <thead>
          <tr>
            <th scope="col">Arm</th>
            <th scope="col">Runs</th>
            <th scope="col">Merged OK</th>
            <th scope="col">Interference</th>
            <th scope="col">Conflicts</th>
            <th scope="col">$/run</th>
            <th scope="col">Tokens/run</th>
            <th scope="col">Detection</th>
          </tr>
        </thead>
        <tbody>
          {arms.map((s) => (
            <tr key={`${s.suite}|${s.arm}`} data-arm={s.arm}>
              <th scope="row">{armName(s.arm)}</th>
              <td>
                {s.runs}
                {s.voided ? <small> +{s.voided} void</small> : null}
              </td>
              <td>{pct(s.successRate)}</td>
              <td>{pct(s.interferenceRate)}</td>
              <td>{pct(s.mergeConflictRate)}</td>
              <td>{usd(s.meanCostUsd)}</td>
              <td>{s.meanNewTokens === null ? "–" : kTokens(s.meanNewTokens)}</td>
              <td>{detection(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
