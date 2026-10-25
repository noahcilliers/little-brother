import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EvalBatchConfig, EvalRunRow } from "@lb/core";
import { buildReplay } from "./publish-pick";
import { agentFiles, batchLabel, loadRun, readRunRecord } from "./publish-read";
import { replayEvents } from "./publish-replay";
import { caughtRelation } from "./publish-row";

// Streams a running eval into Convex (POST /evals/batches and /evals/runs on the deployment's site URL) so
// the public /benchmarks page fills in while the batch runs. Opt-in through env: without it every call is
// a no-op. A failing backend never slows or fails the eval: posts queue in the background, time out, and
// the first failure is logged once.

const POST_TIMEOUT_MS = 5000;
/** Longest the harness waits on exit for posts still queued. */
const DRAIN_MS = 15_000;

export type BatchPlan = { suite: string; model: string; arms: string[]; planned: number; startedAt: number };
export type LivePublisher = {
  /** Posts every run whose run.json appeared since the last call. */
  runDone: () => void;
  finish: (skipped: number) => Promise<void>;
};
type Env = Record<string, string | undefined>;

const NOOP: LivePublisher = { runDone: () => {}, finish: async () => {} };

const drainTimer = () =>
  new Promise<void>((done) => {
    setTimeout(done, DRAIN_MS).unref();
  });

/** Only caught runs carry a replay: they're the ones worth watching, and it keeps the stream small. */
const worthReplaying = (r: EvalRunRow) => r.arm === "on" && !r.voided && r.hits + r.mislabels > 0;

export function livePublisher(
  outDir: string,
  plan: BatchPlan,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): LivePublisher {
  const site = env.LB_EVAL_PUBLISH_URL?.trim().replace(/\/+$/, "");
  const token = env.EVAL_INGEST_TOKEN?.trim();
  if (!site || !token) return NOOP;
  const batch = batchLabel(outDir);
  let queue: Promise<void> = Promise.resolve();
  let warned = false;
  const warn = (e: unknown) => {
    if (warned) return;
    warned = true;
    const why = e instanceof Error ? e.message : String(e);
    console.warn(`live publish to ${site} failed (${why}); the eval goes on, further failures are silent`);
  };
  const send = (path: string, body: unknown) => {
    queue = queue.then(async () => {
      try {
        const res = await fetchImpl(`${site}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(POST_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
      } catch (e) {
        warn(e);
      }
    });
  };
  const config = (finishedAt: number | null, skipped: number): EvalBatchConfig => ({
    batch,
    ...plan,
    finishedAt,
    skipped,
  });
  // run.json mtimes already posted, by run dir: a rerun into the same results dir rewrites one.
  const posted = new Map<string, number>();
  const rows: EvalRunRow[] = [];

  const postNewRuns = () => {
    const runsDir = join(outDir, "runs");
    for (const name of readdirSync(runsDir)) {
      const runDir = join(runsDir, name);
      const record = readRunRecord(runDir);
      if (!record) continue;
      const mtime = statSync(join(runDir, "run.json")).mtimeMs;
      if (posted.get(name) === mtime) continue;
      posted.set(name, mtime);
      const meta = { batch, dir: outDir, model: plan.model, fallbackAt: statSync(outDir).mtimeMs };
      const { row } = loadRun(record, runDir, meta);
      rows.push(row);
      const replay = worthReplaying(row)
        ? buildReplay(row, rows, replayEvents(agentFiles(runDir)), caughtRelation(record))
        : null;
      send("/evals/runs", { batch, row, replay });
    }
  };

  send("/evals/batches", config(null, 0));
  return {
    runDone: () => {
      try {
        postNewRuns();
      } catch (e) {
        warn(e);
      }
    },
    finish: async (skipped) => {
      send("/evals/batches", config(Date.now(), skipped));
      await Promise.race([queue, drainTimer()]);
    },
  };
}
