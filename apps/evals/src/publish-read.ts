import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { EvalRunRow } from "@lb/core";
import type { AgentFiles } from "./publish-replay";
import { armOf, isVoidedStream, PublishedRecord, toRunRow } from "./publish-row";

// Reads a results directory the way the harness wrote it: <dir>/runs.json, summary.json, and per-run dirs
// under runs/ holding run.json, <handle>.stream.jsonl and <handle>.hooks.jsonl.

export type LoadedRun = { row: EvalRunRow; record: PublishedRecord; dir: string | null };

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/** A results dir's batch label, `<parent>/<dir>`: the live stream and the publisher must agree on it. */
export const batchLabel = (dir: string): string => `${basename(dirname(dir))}/${basename(dir)}`;

/** Suite result dirs under `root` (or `root` itself), each labelled by batchLabel. */
export function findBatches(root: string): { batch: string; dir: string }[] {
  if (isDir(join(root, "runs"))) return [{ batch: batchLabel(root), dir: root }];
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((dir) => isDir(join(dir, "runs")))
    .map((dir) => ({ batch: batchLabel(dir), dir }));
}

const keyOf = (r: PublishedRecord) => [r.caseId, r.variant, armOf(r), r.run].join("|");

/** A finished run's record: the harness writes run.json once the run is graded, never before. */
export function readRunRecord(runDir: string): PublishedRecord | null {
  const file = join(runDir, "run.json");
  if (!existsSync(file)) return null;
  const parsed = PublishedRecord.safeParse(readJson(file));
  return parsed.success ? parsed.data : null;
}

function runDirs(dir: string): Map<string, { dir: string; record: PublishedRecord }> {
  const out = new Map<string, { dir: string; record: PublishedRecord }>();
  for (const name of readdirSync(join(dir, "runs"))) {
    const record = readRunRecord(join(dir, "runs", name));
    if (record) out.set(keyOf(record), { dir: join(dir, "runs", name), record });
  }
  return out;
}

export function agentFiles(runDir: string): AgentFiles[] {
  return readdirSync(runDir)
    .filter((f) => f.endsWith(".stream.jsonl"))
    .map((f) => {
      const handle = f.slice(0, -".stream.jsonl".length);
      const hooks = join(runDir, `${handle}.hooks.jsonl`);
      return {
        handle,
        stream: readFileSync(join(runDir, f), "utf8"),
        hooks: existsSync(hooks) ? readFileSync(hooks, "utf8") : "",
      };
    });
}

/** The agent model the harness recorded, else the one the first agent stream reports. */
function modelOf(dir: string, sample: AgentFiles[]): string {
  const summary = join(dir, "summary.json");
  if (existsSync(summary)) {
    const meta = readJson(summary);
    const model = (meta as { meta?: { model?: unknown } }).meta?.model;
    if (typeof model === "string") return model;
  }
  const m = /"model":"(claude-[^"]+)"/.exec(sample[0]?.stream ?? "");
  return m?.[1] ?? "unknown";
}

/**
 * Every run of one batch: runs.json when the batch finished, else the per-run run.json files of a batch
 * still in progress. A run whose dir is missing can't be checked for rate limits and counts as not voided.
 */
export function loadBatch(batch: string, dir: string): LoadedRun[] {
  const dirs = runDirs(dir);
  const listed = join(dir, "runs.json");
  const records = existsSync(listed)
    ? PublishedRecord.array().parse(readJson(listed))
    : [...dirs.values()].map((d) => d.record);
  const first = dirs.values().next().value;
  const model = modelOf(dir, first ? agentFiles(first.dir) : []);
  const fallbackAt = statSync(dir).mtimeMs;
  return records.map((listedRecord) => {
    // run.json is the same record plus agent start times, so it wins when present.
    const found = dirs.get(keyOf(listedRecord));
    return loadRun(found?.record ?? listedRecord, found?.dir ?? null, { batch, dir, model, fallbackAt });
  });
}

export type BatchMeta = { batch: string; dir: string; model: string; fallbackAt: number };

/** One run's published row; the live stream calls this per run, loadBatch for a whole results dir. */
export function loadRun(record: PublishedRecord, runDir: string | null, meta: BatchMeta): LoadedRun {
  const voided = runDir ? agentFiles(runDir).some((a) => isVoidedStream(a.stream)) : false;
  const row = toRunRow(record, {
    batch: meta.batch,
    suite: basename(meta.dir),
    model: meta.model,
    voided,
    fallbackAt: meta.fallbackAt,
  });
  return { row, record, dir: runDir };
}
