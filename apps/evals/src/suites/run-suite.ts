import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { newTokens } from "@lb/core";
import type { Options } from "../options";
import type { RunContext } from "../run-case";
import { type Job, order, runPool } from "../schedule";
import { prepareHarness } from "../setup";
import { cooperTasks } from "./cooperbench";
import type { PairTask } from "./pair-task";
import { renderSuite, summarizeSuite } from "./report-suite";
import { type PairRecord, runPair } from "./run-pair";
import { staleTasks } from "./stale-bench";

function line(r: PairRecord): string {
  const g = r.grade;
  const tokens = r.tokens ? ` · ${Math.round(newTokens(r.tokens) / 1000)}k tok` : "";
  const merge = g?.mergeConflict ? "conflict" : `Δ ${g?.interference ?? "–"}`;
  const solved = Object.values(g?.solved ?? {})
    .map((ok) => (ok ? "✓" : "✗"))
    .join("");
  const caught =
    r.score.expectations.map((e) => e.outcome).join(",") || `FP ${r.score.falsePositives.length}`;
  const outcome = r.error
    ? `ERROR ${r.error.slice(0, 200)}`
    : `${merge} · solved ${solved} · merged ${g?.success ? "pass" : "fail"}${r.arm === "on" ? ` · ${caught}` : ""}`;
  return `${r.suite} ${r.caseId} ${r.arm === "on" ? "LB-on" : r.arm === "off" ? "LB-off" : r.arm} #${r.run}: ${outcome} · $${r.costUsd.toFixed(2)}${tokens} · ${Math.round(r.wallSec)} s`;
}

/** STALE-bench or CooperBench: pairs of live agents on an external repo, graded by the benchmark's tests. */
export async function runSuite(opts: Options): Promise<void> {
  const tasks: PairTask[] = opts.suite === "stale" ? staleTasks(opts.cases) : cooperTasks(opts.cases);
  if (opts.list) {
    for (const t of tasks) console.log(`${t.id.padEnd(40)} ${t.kind} · base ${t.base.slice(0, 10)}`);
    return;
  }
  const h = await prepareHarness(
    opts,
    tasks.flatMap((t) => t.agents.map((a) => a.handle)),
  );
  const ctx: RunContext = {
    backend: h.backend,
    shopSrc: "",
    outDir: h.outDir,
    workDir: h.workDir,
    pluginDir: h.pluginDir,
    mcpConfig: h.mcpConfig,
    cliPath: h.cliPath,
    lbHome: h.lbHome,
    modules: "",
    limits: {
      model: opts.model,
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
      timeoutMin: opts.timeoutMin,
    },
    tag: h.tag,
    settleSec: opts.settleSec,
    fixup: false,
    keepWorkspaces: opts.keepWorkspaces,
  };
  const jobs: Job<PairRecord>[] = tasks.flatMap((t) =>
    Array.from({ length: opts.runs }, (_, i) => i + opts.firstRun).flatMap((run) =>
      opts.arms.map((arm) => ({
        key: `${t.id}-${arm}-${run}`,
        arm,
        block: `${t.id}-${run}`,
        start: () => runPair(t, arm, run, ctx),
      })),
    ),
  );
  console.log(
    `${opts.suite}: ${jobs.length} run(s) over ${tasks.length} task(s) · ${h.backendInfo}\n` +
      `results → ${h.outDir}\nworktrees → ${h.workDir}\nspent so far: ${h.budget.line()}`,
  );
  const { results, skipped } = await runPool(
    order(jobs, opts.paired, opts.seed),
    opts.concurrency,
    h.budget,
    opts.suite,
    line,
  );
  const summary = summarizeSuite(opts.suite, results);
  const meta = {
    startedAt: h.startedAt.toISOString(),
    suite: opts.suite,
    model: opts.model,
    arms: opts.arms,
    runsPerTask: opts.runs,
    tasks: tasks.map((t) => ({ id: t.id, kind: t.kind, base: t.base })),
    backend: h.backendInfo,
    wallSec: (Date.now() - h.startedAt.getTime()) / 1000,
    paired: opts.paired,
    seed: opts.seed,
    skipped,
  };
  writeFileSync(join(h.outDir, "summary.json"), JSON.stringify({ meta, summary }, null, 2));
  writeFileSync(join(h.outDir, "runs.json"), JSON.stringify(results, null, 2));
  writeFileSync(join(h.outDir, "report.md"), renderSuite(summary, results));
  console.log(`\nreport → ${join(h.outDir, "report.md")} · ${h.budget.line()}`);
}
