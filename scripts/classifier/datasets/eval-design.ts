import { CASES } from "../../../apps/evals/cases";
import {
  type Gold,
  type LabelledPair,
  negativeRelation,
  type Relation,
} from "../../../packages/core/src/index";
import { intentPair, lessonNode, planNode } from "./intent-pair";

// Every eval case's two plans as the team designed them, both prompt variants crossed: gold plan-level pairs
// for the planted relation (or a negative for controls), including cases no pilot run has exercised yet.

const VARIANTS = ["pointed", "natural"] as const;
const DESIGN_RELATION: Record<string, Relation> = {
  duplicate: "duplicate",
  conflict: "textual_conflict",
  stale: "repeats_failure",
};

export function designedPairs(skip: ReadonlySet<string>): LabelledPair[] {
  const out: LabelledPair[] = [];
  for (const c of CASES) {
    const [a, b] = c.agents;
    const e = c.expect[0];
    if (!a || !b) continue;
    const planted = e ? (e.relation ?? DESIGN_RELATION[e.type]) : undefined;
    const label: Gold | ((f: number[]) => Gold) = planted
      ? { relation: planted, origin: "eval" }
      : (f) => ({ relation: negativeRelation(f), origin: "eval" });
    for (const va of VARIANTS)
      for (const vb of VARIANTS) {
        if (va === vb && skip.has(`eval:${c.id}:${va}:intent`)) continue;
        const other =
          planted === "repeats_failure"
            ? lessonNode(`${c.id}:${va}:lesson`, "a", a.prompt[va], [], 0)
            : planNode(`${c.id}:${va}:a`, "a", a.prompt[va], 0);
        const row = intentPair(
          `eval:${c.id}:${va}+${vb}:design`,
          `eval:${c.id}`,
          planNode(`${c.id}:${vb}:b`, "b", b.prompt[vb], 60_000),
          other,
          label,
          { source: "eval-intent", repo: `eval:${c.id}` },
        );
        if (row) out.push(row);
      }
  }
  return out;
}
