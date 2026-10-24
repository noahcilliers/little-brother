import { armOf } from "../arm";
import { type ArmComparison, compareArms } from "../arm-stats";
import { armsSection } from "../report-arms";
import type { PairRecord } from "./run-pair";

export type SuiteArm = {
  runs: number;
  /** Runs where the merge had at least one interfering test (Δblind > 0), over runs that merged cleanly. */
  interferenceRate: number | null;
  meanInterference: number | null;
  mergeConflicts: number;
  /** Each agent's own task solved on its own branch, over agent-runs. */
  soloSolveRate: number | null;
  /** Both agents solved alone. */
  bothSolvedRate: number | null;
  successRate: number | null;
};

const ratio = (n: number, d: number): number | null => (d ? n / d : null);

export function suiteArm(runs: PairRecord[]): SuiteArm {
  const graded = runs.filter((r) => !r.error && r.grade);
  const clean = graded.filter((r) => r.grade?.interference !== null && r.grade?.interference !== undefined);
  const inter = clean.map((r) => r.grade?.interference ?? 0);
  const solos = graded.flatMap((r) => Object.values(r.grade?.solved ?? {}));
  return {
    runs: graded.length,
    interferenceRate: ratio(inter.filter((x) => x > 0).length, clean.length),
    meanInterference: inter.length ? inter.reduce((a, b) => a + b, 0) / inter.length : null,
    mergeConflicts: graded.filter((r) => r.grade?.mergeConflict).length,
    soloSolveRate: ratio(solos.filter(Boolean).length, solos.length),
    bothSolvedRate: ratio(
      graded.filter((r) => Object.values(r.grade?.solved ?? {}).every(Boolean)).length,
      graded.length,
    ),
    successRate: ratio(graded.filter((r) => r.grade?.success).length, graded.length),
  };
}

export type SuiteSummary = {
  suite: string;
  off: SuiteArm;
  on: SuiteArm;
  byKind: { kind: string; off: SuiteArm; on: SuiteArm }[];
  arms: ArmComparison;
};

export function summarizeSuite(suite: string, runs: PairRecord[]): SuiteSummary {
  const arm = (a: "on" | "off", rs: PairRecord[]) => suiteArm(rs.filter((r) => armOf(r) === a));
  const kinds = [...new Set(runs.map((r) => r.kind.split(":")[0] ?? r.kind))];
  return {
    suite,
    off: arm("off", runs),
    on: arm("on", runs),
    byKind: kinds.map((kind) => {
      const rs = runs.filter((r) => r.kind.startsWith(kind));
      return { kind, off: arm("off", rs), on: arm("on", rs) };
    }),
    arms: compareArms(runs),
  };
}

const pct = (x: number | null): string => (x === null ? "–" : `${Math.round(x * 100)}%`);
const num = (x: number | null): string => (x === null ? "–" : x.toFixed(2));

function outcomeRows(label: string, off: SuiteArm, on: SuiteArm): string[] {
  const row = (name: string, f: (a: SuiteArm) => string) => `| ${label} | ${name} | ${f(off)} | ${f(on)} |`;
  return [
    row("Graded runs", (a) => String(a.runs)),
    row("Interference rate (Δblind > 0, clean merges)", (a) => pct(a.interferenceRate)),
    row("Mean interfering tests", (a) => num(a.meanInterference)),
    row("Merge conflicts", (a) => String(a.mergeConflicts)),
    row("Own task solved alone", (a) => pct(a.soloSolveRate)),
    row("Both solved alone", (a) => pct(a.bothSolvedRate)),
    row("Merged success", (a) => pct(a.successRate)),
  ];
}

export function renderSuite(s: SuiteSummary, runs: PairRecord[]): string {
  const perRun = runs
    .slice()
    .sort((a, b) => `${a.caseId}${a.arm}${a.run}`.localeCompare(`${b.caseId}${b.arm}${b.run}`))
    .map((r) => {
      const g = r.grade;
      const solved = g
        ? Object.entries(g.solved)
            .map(([h, ok]) => `${h} ${ok ? "✓" : "✗"}`)
            .join(", ")
        : "–";
      const caught =
        r.score.expectations.map((e) => e.outcome).join(",") || (r.score.falsePositives.length ? "FP" : "–");
      return `| \`${r.caseId}\` | ${r.kind} | ${armOf(r)} #${r.run} | ${r.error ? `error: ${r.error.slice(0, 80)}` : g?.mergeConflict ? "conflict" : String(g?.interference ?? "–")} | ${solved} | ${g?.success ? "pass" : "fail"} | ${armOf(r) === "on" ? caught : "–"} | $${r.costUsd.toFixed(2)} |`;
    });
  return [
    `# ${s.suite} suite`,
    "",
    "| Slice | Metric | Off | On |",
    "| --- | --- | --- | --- |",
    ...outcomeRows("all", s.off, s.on),
    ...s.byKind.flatMap((k) => outcomeRows(k.kind, k.off, k.on)),
    "",
    ...armsSection(`${s.suite} suite`, s.arms),
    "## Runs",
    "",
    "| Task | Kind | Arm | Interference | Solved alone | Merged | LB detection | $ |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...perRun,
    "",
  ].join("\n");
}
