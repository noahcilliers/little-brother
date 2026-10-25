import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ClassifierBench, type EvalReplay, LandingEvals, summarizeEvalRuns } from "@lb/core";
import { sh } from "./exec";
import { classifierBench } from "./publish-classifier";
import { PUBLISH_USAGE, parsePublishOptions } from "./publish-options";
import { buildReplay, pickReplayRow } from "./publish-pick";
import { agentFiles, findBatches, type LoadedRun, loadBatch } from "./publish-read";
import { replayEvents } from "./publish-replay";
import { caughtRelation } from "./publish-row";

// Publishes eval results to Convex for the landing: run rows (summaries are recomputed server side), one
// featured replay, and the pair model's benchmark. Re-running is safe: every write upserts by key.

const BACKEND_DIR = fileURLToPath(new URL("../../../packages/backend", import.meta.url));
/** Rows per `convex run` call, well under the CLI's argument size. */
const CHUNK = 40;

function convexRun(fn: string, args: unknown, prod: boolean): string {
  const r = sh("npx", ["convex", "run", ...(prod ? ["--prod"] : []), fn, JSON.stringify(args)], BACKEND_DIR);
  if (!r.ok) throw new Error(`convex run ${fn} failed: ${r.out.trim().slice(-600)}`);
  return r.out.trim();
}

function featuredReplay(runs: LoadedRun[], key: string | null): EvalReplay | null {
  const rows = runs.map((r) => r.row);
  const row = key ? rows.find((r) => r.runKey === key) : pickReplayRow(rows);
  if (key && !row) throw new Error(`no run with key ${key}`);
  const run = runs.find((r) => r.row.runKey === row?.runKey);
  if (!row || !run?.dir) return null;
  if (row.voided) throw new Error(`${row.runKey} is voided (rate limited); pick another run`);
  return buildReplay(row, rows, replayEvents(agentFiles(run.dir)), caughtRelation(run.record));
}

function main(): void {
  const opts = parsePublishOptions(process.argv.slice(2));
  if (!opts.results.length && !opts.classifier) {
    console.error(PUBLISH_USAGE);
    process.exit(2);
  }
  const runs = opts.results.flatMap((root) =>
    findBatches(resolve(root)).flatMap(({ batch, dir }) => loadBatch(batch, dir)),
  );
  const rows = runs.map((r) => r.row);
  const replay = featuredReplay(runs, opts.replay);
  const classifier: ClassifierBench | null = opts.classifier
    ? classifierBench(
        JSON.parse(readFileSync(resolve(opts.classifier), "utf8")),
        opts.latencyMd ? readFileSync(resolve(opts.latencyMd), "utf8") : null,
        Date.now(),
      )
    : null;
  const summaries = summarizeEvalRuns(rows);
  const voided = rows.filter((r) => r.voided).length;
  console.log(
    `${rows.length} runs (${voided} voided) in ${new Set(rows.map((r) => r.batch)).size} batches · ${summaries.length} summaries`,
  );
  if (replay) console.log(`replay: ${replay.runKey} (${replay.events.length} events)`);
  if (classifier) console.log(`classifier: ${classifier.version}`);

  if (opts.snapshot) {
    const snapshot = LandingEvals.parse({ summaries, replay, classifier });
    writeFileSync(resolve(opts.snapshot), `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`wrote ${opts.snapshot}`);
  }
  if (!opts.push) {
    console.log("dry run: pass --push to send to Convex");
    return;
  }
  for (let i = 0; i < rows.length; i += CHUNK)
    console.log(convexRun("evalBoard:ingestRuns", { rows: rows.slice(i, i + CHUNK) }, opts.prod));
  if (replay) console.log(convexRun("evalBoard:ingestReplay", { replay, featured: true }, opts.prod));
  if (classifier) console.log(convexRun("evalBoard:ingestClassifier", { bench: classifier }, opts.prod));
}

main();
