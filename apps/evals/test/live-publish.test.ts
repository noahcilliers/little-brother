import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type BatchPlan, livePublisher } from "../src/live-publish";
import { loadBatch } from "../src/publish-read";

const plan: BatchPlan = { suite: "stale", model: "sonnet", arms: ["off", "on"], planned: 2, startedAt: 1 };
const ENV = { LB_EVAL_PUBLISH_URL: "https://x.convex.site/", EVAL_INGEST_TOKEN: "secret" };

const record = (arm: string, hit: boolean) => ({
  suite: "stale",
  caseId: "django/1",
  variant: "pointed",
  arm,
  run: 1,
  score: { expectations: hit ? [{ outcome: "hit", detectSec: 2 }] : [], falsePositives: [] },
  costUsd: 0.5,
  wallSec: 30,
  catches: hit ? 1 : 0,
  agents: [{ handle: "ash", startedAt: 1234 }],
});

function resultsDir(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "lb-live-")), "batch-1");
  mkdirSync(join(dir, "runs"), { recursive: true });
  return dir;
}

function finishRun(dir: string, name: string, rec: unknown, stream = "") {
  mkdirSync(join(dir, "runs", name), { recursive: true });
  writeFileSync(join(dir, "runs", name, "ash.stream.jsonl"), stream);
  writeFileSync(join(dir, "runs", name, "run.json"), JSON.stringify(rec));
}

type Call = { url: string; body: Record<string, unknown> };
function recorder(fail = false) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    if (fail) throw new Error("connection refused");
    return new Response("{}", { status: 200 });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

afterEach(() => vi.restoreAllMocks());

describe("livePublisher", () => {
  it("is a no-op without both env vars", async () => {
    const { calls, fetchImpl } = recorder();
    for (const env of [{}, { LB_EVAL_PUBLISH_URL: ENV.LB_EVAL_PUBLISH_URL }, { EVAL_INGEST_TOKEN: "t" }]) {
      const live = livePublisher("/nonexistent/results/dir", plan, env, fetchImpl);
      live.runDone();
      await live.finish(0);
    }
    expect(calls).toHaveLength(0);
  });

  it("posts the plan, each graded run once with the publisher's row, then the finish", async () => {
    const dir = resultsDir();
    const { calls, fetchImpl } = recorder();
    const live = livePublisher(dir, plan, ENV, fetchImpl);
    finishRun(dir, "on-1", record("on", true));
    live.runDone();
    live.runDone();
    finishRun(dir, "off-1", record("off", false), '{"api_error_status":429}');
    live.runDone();
    await live.finish(1);

    expect(calls.map((c) => c.url)).toEqual([
      "https://x.convex.site/evals/batches",
      "https://x.convex.site/evals/runs",
      "https://x.convex.site/evals/runs",
      "https://x.convex.site/evals/batches",
    ]);
    expect(calls[0]?.body).toMatchObject({
      batch: expect.stringMatching(/\/batch-1$/),
      planned: 2,
      finishedAt: null,
    });
    expect(calls[3]?.body).toMatchObject({ skipped: 1, finishedAt: expect.any(Number) });
    const posted = calls.slice(1, 3).map((c) => c.body.row);
    // Same rows the after-the-fact publisher reads from the same dir (it reads the model from summary.json).
    writeFileSync(join(dir, "summary.json"), JSON.stringify({ meta: { model: "sonnet" } }));
    const published = loadBatch(String(calls[0]?.body.batch), dir).map((r) => r.row);
    expect(posted).toHaveLength(published.length);
    expect(posted).toEqual(expect.arrayContaining(published));
    expect(calls[1]?.body.replay).toMatchObject({ runKey: expect.stringContaining("/on/1") });
    expect(calls[2]?.body).toMatchObject({ row: { voided: true }, replay: null });
  });

  it("swallows network failures and warns once", async () => {
    const dir = resultsDir();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { calls, fetchImpl } = recorder(true);
    const live = livePublisher(dir, plan, ENV, fetchImpl);
    finishRun(dir, "on-1", record("on", true));
    expect(() => live.runDone()).not.toThrow();
    await expect(live.finish(0)).resolves.toBeUndefined();
    expect(calls).toHaveLength(3);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("survives a results dir that vanished", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = recorder();
    const live = livePublisher("/nonexistent/results/dir", plan, ENV, fetchImpl);
    expect(() => live.runDone()).not.toThrow();
    await live.finish(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
