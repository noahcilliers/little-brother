import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "../cases";
import { type RunRecord, type Summary, summarize } from "./aggregate";
import { type Backend, describeBackend, healthy } from "./backend";
import { caseProblems, type EvalCase } from "./case";
import { renderCompare } from "./compare";
import { shOrThrow } from "./exec";
import { parseOptions } from "./options";
import { buildEvalPlugin, writeMcpConfig } from "./plugin";
import { renderReport } from "./report";
import { type RunContext, runCase } from "./run-case";
import { prepareModules } from "./workspace";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI = join(ROOT, "apps/connector/dist/cli.js");

function select(ids: string[]): EvalCase[] {
  if (!ids.length) return CASES;
  const picked = CASES.filter((c) => ids.some((id) => c.id === id || c.id.startsWith(id)));
  if (!picked.length) throw new Error(`no case matches ${ids.join(", ")}; try --list`);
  return picked;
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      if (item !== undefined) out[i] = await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

function joinAgents(lbHome: string, site: string, handles: string[]): void {
  const env = { ...process.env, LB_HOME: lbHome };
  const invite = process.env.LB_INVITE_CODE ?? "calhacks";
  for (const h of handles)
    shOrThrow("node", [CLI, "join", "--url", site, "--invite", invite, "--as", h], ROOT, env);
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
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
  const backend: Backend = { dir: join(ROOT, "packages/backend"), siteUrl: opts.site };
  if (!(await healthy(backend)))
    throw new Error(
      `no backend at ${opts.site}: run \`npx convex dev\` in packages/backend (CONVEX_AGENT_MODE=anonymous)`,
    );
  const backendInfo = describeBackend(backend);
  if (!backendInfo.includes("open mode on"))
    throw new Error(
      "backend is not in open mode: `npx convex env set LB_ALLOW_INVITE 1` in packages/backend",
    );
  if (opts.build) shOrThrow("npm", ["run", "build", "--silent"], join(ROOT, "apps/connector"));
  if (!existsSync(CLI)) throw new Error(`connector not built at ${CLI}`);

  const startedAt = new Date();
  const tag = startedAt.toISOString().replace(/[-:]/g, "").slice(4, 13).replace("T", "");
  const outDir = resolve(
    opts.out ?? join(ROOT, "apps/evals/results", startedAt.toISOString().replace(/[:.]/g, "-")),
  );
  const workDir = join(realpathSync("/tmp"), "lb-evals", tag);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  const lbHome = join(outDir, "lb-home");
  joinAgents(lbHome, opts.site, [...new Set(cases.flatMap((c) => c.agents.map((a) => a.handle)))]);
  const shopSrc = join(ROOT, "demo/shop");
  const ctx: RunContext = {
    backend,
    shopSrc,
    outDir,
    workDir,
    pluginDir: buildEvalPlugin(join(ROOT, "plugin"), outDir, CLI),
    mcpConfig: writeMcpConfig(outDir, CLI),
    cliPath: CLI,
    lbHome,
    modules: prepareModules(shopSrc, join(ROOT, "apps/evals/results/.cache")),
    limits: {
      model: opts.model,
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
      timeoutMin: opts.timeoutMin,
    },
    tag,
    settleSec: opts.settleSec,
  };
  const jobs = cases.flatMap((c) =>
    opts.variants.flatMap((v) => Array.from({ length: opts.runs }, (_, i) => ({ c, v, run: i + 1 }))),
  );
  console.log(`${jobs.length} run(s) · ${backendInfo}\nresults → ${outDir}\nworktrees → ${workDir}`);
  let done = 0;
  const runs: RunRecord[] = await pool(jobs, opts.concurrency, async ({ c, v, run }) => {
    const r = await runCase(c, v, run, ctx);
    const outcomes =
      r.score.expectations.map((e) => e.outcome).join(",") || (r.score.control ? "control" : "-");
    console.log(
      `[${++done}/${jobs.length}] ${c.id} ${v} #${run}: ${r.error ? `ERROR ${r.error}` : outcomes} · FP ${r.score.falsePositives.length} · $${r.costUsd.toFixed(2)} · ${Math.round(r.wallSec)} s`,
    );
    return r;
  });

  const summary = summarize(runs);
  const meta = {
    startedAt: startedAt.toISOString(),
    model: opts.model,
    variants: opts.variants,
    runsPerCase: opts.runs,
    backend: backendInfo,
    wallSec: (Date.now() - startedAt.getTime()) / 1000,
  };
  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ meta, summary }, null, 2));
  writeFileSync(join(outDir, "runs.json"), JSON.stringify(runs, null, 2));
  let report = renderReport(meta, summary, runs);
  if (opts.compare) {
    const base = JSON.parse(readFileSync(join(resolve(opts.compare), "summary.json"), "utf8")) as {
      summary: Summary;
    };
    report += `\n${renderCompare(base.summary, summary)}`;
  }
  writeFileSync(join(outDir, "report.md"), report);
  console.log(`\nreport → ${join(outDir, "report.md")}`);
}

main().catch((e: unknown) => {
  console.error(`evals: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
