import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { RunRecord } from "./aggregate";
import { spawnOverheadMs } from "./calibrate";
import { siteBenchmarks } from "./site-benchmarks";

// pnpm --filter @lb/evals site-summary --planted dirA,dirB --suites dirC,dirD --out docs/evals/<date>-summary.json
// Planted results feed the site's benchmark numbers; suite results (STALE-bench, CooperBench) ride along
// as headline outcomes. Each dir is an eval results directory with runs.json and summary.json.

const read = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const dirs = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((d) => resolve(d));

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { planted: { type: "string" }, suites: { type: "string" }, out: { type: "string" } },
  });
  if (!values.out) throw new Error("--out file required");
  const planted = dirs(values.planted);
  const runs = planted.flatMap((d) => read(`${d}/runs.json`) as RunRecord[]);
  const suites = dirs(values.suites)
    .filter((d) => existsSync(`${d}/summary.json`))
    .map((d) => {
      const s = read(`${d}/summary.json`) as {
        meta: unknown;
        summary: { suite: string; off: unknown; on: unknown };
      };
      return { dir: d, suite: s.summary.suite, off: s.summary.off, on: s.summary.on };
    });
  const out = {
    generatedAt: new Date().toISOString(),
    source: { planted, suites: suites.map((s) => s.dir) },
    ...siteBenchmarks(runs, spawnOverheadMs()),
    suites: Object.fromEntries(suites.map((s) => [s.suite, { off: s.off, on: s.on }])),
  };
  mkdirSync(dirname(resolve(values.out)), { recursive: true });
  writeFileSync(resolve(values.out), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`site summary → ${resolve(values.out)}`);
}

main();
