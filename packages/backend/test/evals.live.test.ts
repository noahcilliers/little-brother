import type { EvalBatchConfig, EvalReplay, EvalRunRow } from "@lb/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeT, type T } from "./platformHelpers";

const SECRET = "eval-secret-for-tests";

const post = (t: T, path: string, body: unknown, token?: string) =>
  t.fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const plan: EvalBatchConfig = {
  batch: "results/live",
  suite: "stale",
  model: "sonnet",
  arms: ["off", "on"],
  planned: 4,
  startedAt: 1000,
  finishedAt: null,
  skipped: 0,
};

const row = (over: Partial<EvalRunRow>): EvalRunRow => ({
  runKey: "results/live/c/pointed/on/1",
  batch: "results/live",
  suite: "stale",
  caseId: "c",
  variant: "pointed",
  arm: "on",
  run: 1,
  model: "sonnet",
  costUsd: 0.4,
  newTokens: 2000,
  wallSec: 80,
  finalSuccess: true,
  mergeConflict: false,
  interference: 0,
  catches: 1,
  hits: 1,
  mislabels: 0,
  misses: 0,
  falsePositives: 0,
  detectSec: 3,
  voided: false,
  at: 1100,
  ...over,
});

const replay: EvalReplay = {
  runKey: "results/live/c/pointed/on/1",
  batch: "results/live",
  suite: "stale",
  caseId: "c",
  model: "sonnet",
  agents: ["ash"],
  events: [{ t: 0, agent: "ash", kind: "catch", text: "duplicate · utils.py" }],
  outcome: {
    finalSuccess: true,
    mergeConflict: false,
    costUsd: 0.4,
    newTokens: 2000,
    wallSec: 80,
    relation: null,
  },
  contrast: null,
};

describe("live eval ingest over HTTP", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("refuses every write while EVAL_INGEST_TOKEN is unset", async () => {
    vi.stubEnv("EVAL_INGEST_TOKEN", "");
    const t = makeT();
    expect((await post(t, "/evals/batches", plan, SECRET)).status).toBe(503);
    expect((await post(t, "/evals/runs", { batch: plan.batch, row: row({}) }, SECRET)).status).toBe(503);
    expect(await t.run((ctx) => ctx.db.query("evalBatches").collect())).toHaveLength(0);
  });

  describe("with a secret configured", () => {
    beforeEach(() => vi.stubEnv("EVAL_INGEST_TOKEN", SECRET));

    test("rejects a missing or wrong token and a malformed body", async () => {
      const t = makeT();
      expect((await post(t, "/evals/batches", plan)).status).toBe(401);
      expect((await post(t, "/evals/batches", plan, `${SECRET}x`)).status).toBe(401);
      expect((await post(t, "/evals/runs", { batch: "other", row: row({}) }, SECRET)).status).toBe(400);
      expect((await post(t, "/evals/runs", { batch: plan.batch }, SECRET)).status).toBe(400);
      expect(await t.run((ctx) => ctx.db.query("evalRuns").collect())).toHaveLength(0);
    });

    test("streams a batch: plan, runs as they land, re-posts change nothing, then the finish", async () => {
      const t = makeT();
      expect((await post(t, "/evals/batches", plan, SECRET)).status).toBe(200);
      let board = await t.query(api.evalLive.board, {});
      expect(board.batches[0]).toMatchObject({ status: "running", graded: 0, planned: 4 });

      const first = await post(t, "/evals/runs", { batch: plan.batch, row: row({}), replay }, SECRET);
      expect(await first.json()).toMatchObject({ inserted: 1, updated: 0, replay: true });
      const again = await post(t, "/evals/runs", { batch: plan.batch, row: row({}), replay }, SECRET);
      expect(await again.json()).toMatchObject({ inserted: 0, updated: 1 });
      const voided = row({ runKey: "results/live/c/pointed/off/1", arm: "off", voided: true, hits: 0 });
      expect((await post(t, "/evals/runs", { batch: plan.batch, row: voided }, SECRET)).status).toBe(200);

      board = await t.query(api.evalLive.board, {});
      expect(board.batches[0]).toMatchObject({ graded: 2, voided: 1, status: "running" });
      expect(board.batches[0]?.perArm.find((s) => s.arm === "on")).toMatchObject({ runs: 1, caught: 1 });
      expect(board.feed.map((r) => r.arm)).toEqual(["off", "on"]);
      expect(board.feed[0]).not.toHaveProperty("detectSec");
      expect(await t.run((ctx) => ctx.db.query("evalRuns").collect())).toHaveLength(2);
      const stored = await t.run((ctx) => ctx.db.query("evalReplays").collect());
      expect(stored.map((r) => [r.runKey, r.featured])).toEqual([[replay.runKey, false]]);

      await post(t, "/evals/batches", { ...plan, finishedAt: 5000, skipped: 1 }, SECRET);
      board = await t.query(api.evalLive.board, {});
      expect(board.batches[0]).toMatchObject({ status: "finished", finishedAt: 5000, skipped: 1 });
      expect(await t.run((ctx) => ctx.db.query("evalBatches").collect())).toHaveLength(1);
    });

    test("an unfeatured re-post keeps the landing's featured replay", async () => {
      const t = makeT();
      await t.mutation(internal.evalBoard.ingestReplay, { replay, featured: true });
      await post(t, "/evals/runs", { batch: plan.batch, row: row({}), replay }, SECRET);
      const landing = await t.query(api.evalLanding.landing, {});
      expect(landing.replay?.runKey).toBe(replay.runKey);
    });
  });
});
