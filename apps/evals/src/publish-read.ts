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

/** Suite result dirs under `root` (or `root` itself), each labelled `<parent>/<dir>` as its batch. */
export function findBatches(root: string): { batch: string; dir: string }[] {
  const label = (dir: string) => `${basename(dirname(dir))}/${basename(dir)}`;
  if (isDir(join(root, "runs"))) return [{ batch: label(root), dir: root }];
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((dir) => isDir(join(dir, "runs")))
    .map((dir) => ({ batch: label(dir), dir }));
}

const keyOf = (r: PublishedRecord) => [r.caseId, r.variant, armOf(r), r.run].join("|");

function runDirs(dir: string): Map<string, { dir: string; record: PublishedRecord }> {
  const out = new Map<string, { dir: string; record: PublishedRecord }>();
  for (const name of readdirSync(join(dir, "runs"))) {
    const file = join(dir, "runs", name, "run.json");
    if (!existsSync(file)) continue;
    const parsed = PublishedRecord.safeParse(readJson(file));
    if (parsed.success) out.set(keyOf(parsed.data), { dir: join(dir, "runs", name), record: parsed.data });
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
    const record = found?.record ?? listedRecord;
    const runDir = found?.dir ?? null;
    const voided = runDir ? agentFiles(runDir).some((a) => isVoidedStream(a.stream)) : false;
    const meta = { batch, suite: basename(dir), model, voided, fallbackAt };
    return { row: toRunRow(record, meta), record, dir: runDir };
  });
}
