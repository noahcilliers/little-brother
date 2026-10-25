import type { ClassifierBench, EvalReplay, EvalRunRow } from "@lb/core";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeT } from "./platformHelpers";

const row = (over: Partial<EvalRunRow>): EvalRunRow => ({
  runKey: "b/dup/pointed/on/1",
  batch: "b",
  suite: "large",
  caseId: "dup",
  variant: "pointed",
  arm: "on",
  run: 1,
  model: "sonnet",
  costUsd: 0.2,
  newTokens: 30000,
  wallSec: 90,
  finalSuccess: true,
  mergeConflict: false,
  interference: null,
  catches: 1,
  hits: 1,
  mislabels: 0,
  misses: 0,
  falsePositives: 0,
  detectSec: 12,
  voided: false,
  at: 1,
  ...over,
});

const replay = (runKey: string): EvalReplay => ({
  runKey,
  batch: "b",
  suite: "large",
  caseId: "dup",
  model: "sonnet",
  agents: ["noah", "joshua"],
  events: [{ t: 0, agent: "joshua", kind: "deny", text: "duplicate · src/rate-limit.ts" }],
  outcome: {
    finalSuccess: true,
    mergeConflict: false,
    costUsd: 0.2,
    newTokens: 30000,
    wallSec: 90,
    relation: null,
  },
  contrast: null,
});

const bench: ClassifierBench = {
  version: "v2",
  goldPairs: 10,
  groups: 2,
  openPairs: 8,
  settledByModel: 2,
  settledShare: 0.25,
  settledAccuracy: 1,
  modelMsPerPair: 0.07,
  judgeMsPerPair: 7000,
  relations: [{ relation: "independent", support: 4, f1: 0.5, settled: 2, settledPrecision: 1 }],
  at: 5,
};

describe("eval board", () => {
  test("the landing query is empty before anything is published", async () => {
    const t = makeT();
    expect(await t.query(api.evalLanding.landing, {})).toEqual({
      summaries: [],
      replay: null,
      classifier: null,
    });
  });

  test("ingest is idempotent by run key and summaries leave voided runs out", async () => {
    const t = makeT();
    const rows = [
      row({}),
      row({ runKey: "b/dup/pointed/on/2", run: 2, costUsd: 0.01, voided: true }),
      row({
        runKey: "b/dup/pointed/off/1",
        arm: "off",
        mergeConflict: true,
        costUsd: 0.4,
        hits: 0,
        misses: 1,
      }),
    ];
    expect(await t.mutation(internal.evalBoard.ingestRuns, { rows })).toEqual({
      inserted: 3,
      updated: 0,
      summaries: 2,
    });
    expect(await t.mutation(internal.evalBoard.ingestRuns, { rows })).toMatchObject({
      inserted: 0,
      updated: 3,
    });
    const { summaries } = await t.query(api.evalLanding.landing, {});
    expect(summaries).toHaveLength(2);
    const on = summaries.find((s) => s.arm === "on");
    expect(on).toMatchObject({ runs: 1, voided: 1, meanCostUsd: 0.2, caught: 1 });
    expect(summaries.find((s) => s.arm === "off")?.mergeConflictRate).toBe(1);
    expect(await t.run((ctx) => ctx.db.query("evalRuns").collect())).toHaveLength(3);
  });

  test("one featured replay at a time, and the latest classifier benchmark", async () => {
    const t = makeT();
    await t.mutation(internal.evalBoard.ingestReplay, { replay: replay("first"), featured: true });
    await t.mutation(internal.evalBoard.ingestReplay, { replay: replay("second"), featured: true });
    await t.mutation(internal.evalBoard.ingestClassifier, { bench });
    await t.mutation(internal.evalBoard.ingestClassifier, { bench: { ...bench, settledByModel: 3 } });
    const landing = await t.query(api.evalLanding.landing, {});
    expect(landing.replay?.runKey).toBe("second");
    expect(landing.replay).not.toHaveProperty("featured");
    expect(landing.classifier).toMatchObject({ version: "v2", settledByModel: 3 });
    expect(await t.run((ctx) => ctx.db.query("classifierBenches").collect())).toHaveLength(1);
    const featured = await t.run((ctx) => ctx.db.query("evalReplays").collect());
    expect(featured.filter((r) => r.featured).map((r) => r.runKey)).toEqual(["second"]);
  });
});
