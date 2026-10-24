import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { newTokens } from "@lb/core";
import { CASES } from "../cases";
import { type RunRecord, type Summary, summarize } from "./aggregate";
import { spawnOverheadMs } from "./calibrate";
import { caseProblems, type EvalCase } from "./case";
import { renderCompare } from "./compare";
import { exportPairs } from "./export-pairs";
import { parseOptions } from "./options";
import { recheck } from "./recheck";
import { renderReport } from "./report";
import { type RunContext, runCase } from "./run-case";
import { type Job, order, runPool } from "./schedule";
import { prepareHarness, ROOT } from "./setup";
import { runSuite } from "./suites/run-suite";
import { prepareModules } from "./workspace";

function select(ids: string[]): EvalCase[] {
  if (!ids.length) return CASES;
  const picked = CASES.filter((c) => ids.some((id) => c.id === id || c.id.startsWith(id)));
  if (!picked.length) throw new Error(`no case matches ${ids.join(", ")}; try --list`);
  return picked;
}

function outcomeLine(r: RunRecord): string {
  // With Little Brother off there are no rows to score, only whether the clash happened.
  const outcomes =
    r.score.expectations
      .map((e) => (r.arm === "off" ? (e.materialized ? "clash" : "no-clash") : e.outcome))
      .join(",") || (r.score.control ? "control" : "-");
  const tokens = r.tokens ? ` · ${Math.round(newTokens(r.tokens) / 1000)}k tok` : "";
  const final = r.finalSuccess === undefined ? "" : ` · final ${r.finalSuccess ? "pass" : "FAIL"}`;
  return `${r.caseId} ${r.variant} ${r.arm === "off" ? "LB-off " : ""}#${r.run}: ${r.error ? `ERROR ${r.error}` : outcomes}${final} · FP ${r.score.falsePositives.length} · $${r.costUsd.toFixed(2)}${tokens} · ${Math.round(r.wallSec)} s`;
}

/** Summary and report again for runs re-graded by --recheck, keeping the original meta. */
function rewriteReport(outDir: string, runs: RunRecord[]): void {
  const prev = JSON.parse(readFileSync(join(outDir, "summary.json"), "utf8")) as {
    meta: Parameters<typeof renderReport>[0];
  };
  const summary = summarize(runs, spawnOverheadMs());
  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ meta: prev.meta, summary }, null, 2));
  writeFileSync(join(outDir, "report.md"), renderReport(prev.meta, summary, runs));
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  if (opts.exportPairs) {
    const s = exportPairs(resolve(opts.exportPairs));
    console.log(`pairs → ${join(resolve(opts.exportPairs), "pairs.jsonl")}: ${JSON.stringify(s)}`);
    return;
  }
  if (opts.recheck) return rewriteReport(resolve(opts.recheck), await recheck(resolve(opts.recheck)));
  if (opts.suite !== "planted") return runSuite(opts);
  const problems = CASES.flatMap((c) => caseProblems(c).map((p) => `${c.id}: ${p}`));
  if (problems.length) throw new Error(`invalid cases:\n${problems.join("\n")}`);
  const cases = select(opts.cases);
  if (opts.list) {
    for (const c of cases)
      console.log(
        `${c.id.padEnd(28)} ${c.expect.length ? c.expect.map((e) => e.type).join(",") : "control"} · ${c.title}`,
      );
    return;
  }
  const h = await prepareHarness(
    opts,
    cases.flatMap((c) => c.agents.map((a) => a.handle)),
  );
  const shopSrc = join(ROOT, "demo/shop");
  const ctx: RunContext = {
    backend: h.backend,
    shopSrc,
    outDir: h.outDir,
    workDir: h.workDir,
    pluginDir: h.pluginDir,
    mcpConfig: h.mcpConfig,
    cliPath: h.cliPath,
    lbHome: h.lbHome,
    modules: prepareModules(shopSrc, join(ROOT, "apps/evals/results/.cache")),
    limits: {
      model: opts.model,
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
      timeoutMin: opts.timeoutMin,
    },
    tag: h.tag,
    settleSec: opts.settleSec,
    fixup: opts.fixup,
  };
  const jobs: Job<RunRecord>[] = cases.flatMap((c) =>
    opts.variants.flatMap((v) =>
      Array.from({ length: opts.runs }, (_, i) => i + 1).flatMap((run) =>
        opts.arms.map((arm) => ({
          key: `${c.id}-${v}-${arm}-${run}`,
          arm,
          block: `${c.id}-${v}-${run}`,
          start: () => runCase(c, v, arm, run, ctx),
        })),
      ),
    ),
  );
  console.log(
    `${jobs.length} run(s) · ${h.backendInfo}${opts.fixup ? " · fix-up on" : ""}${opts.paired ? ` · paired, seed ${opts.seed}` : ""}\n` +
      `results → ${h.outDir}\nworktrees → ${h.workDir}\nspent so far: ${h.budget.line()}`,
  );
  const { results: runs, skipped } = await runPool(
    order(jobs, opts.paired, opts.seed),
    opts.concurrency,
    h.budget,
    "planted",
    outcomeLine,
  );

  const summary = summarize(runs, spawnOverheadMs());
  const meta = {
    startedAt: h.startedAt.toISOString(),
    model: opts.model,
    variants: opts.variants,
    arms: opts.arms,
    runsPerCase: opts.runs,
    backend: h.backendInfo,
    wallSec: (Date.now() - h.startedAt.getTime()) / 1000,
    fixup: opts.fixup,
    paired: opts.paired,
    seed: opts.seed,
    skipped,
  };
  writeFileSync(join(h.outDir, "summary.json"), JSON.stringify({ meta, summary }, null, 2));
  writeFileSync(join(h.outDir, "runs.json"), JSON.stringify(runs, null, 2));
  let report = renderReport(meta, summary, runs);
  if (opts.compare) {
    const base = JSON.parse(readFileSync(join(resolve(opts.compare), "summary.json"), "utf8")) as {
      summary: Summary;
    };
    report += `\n${renderCompare(base.summary, summary)}`;
  }
  writeFileSync(join(h.outDir, "report.md"), report);
  console.log(`\nreport → ${join(h.outDir, "report.md")} · ${h.budget.line()}`);
}

main().catch((e: unknown) => {
  console.error(`evals: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
