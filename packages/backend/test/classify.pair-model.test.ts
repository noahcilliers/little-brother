import { FEATURE_NAMES, FEATURE_VERSION, type Judge } from "@lb/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./platformHelpers";

const judgeCalls = vi.fn();
const fakeJudge: Judge & { distill: () => Promise<string | null> } = {
  async judge(pair) {
    judgeCalls(pair.other.id);
    return {
      otherNodeId: pair.other.id,
      relation: "repeats_failure",
      direction: "new_needs_other",
      confidence: 0.82,
      evidence: ["judge: wildcard CORS already failed"],
      source: "llm",
    };
  },
  distill: async () => null,
};

vi.mock("../convex/classify/adapters/select", () => ({
  selectEmbedder: () => null,
  selectJudge: () => fakeJudge,
}));

/** Ignores its features: always answers repeats_failure with softmax(0, bias). */
function tinyModel(bias: number, featureVersion = FEATURE_VERSION) {
  const zeros = FEATURE_NAMES.map(() => 0);
  return {
    format: "lb-pair-model",
    version: `tiny-${bias}`,
    featureVersion,
    featureNames: [...FEATURE_NAMES],
    classes: ["independent", "repeats_failure"],
    estimator: {
      kind: "logreg",
      mean: zeros,
      scale: zeros.map(() => 1),
      weights: [zeros, zeros],
      bias: [0, bias],
    },
    synthetic: true,
  };
}

async function setup() {
  const t = makeT();
  const [noah, ash] = await t.run(async (ctx) => {
    const ids = [];
    for (const handle of ["noah", "ash"]) {
      const memberId = await ctx.db.insert("members", {
        name: handle,
        handle,
        tokenHash: handle,
        revoked: false,
      });
      ids.push(
        await ctx.db.insert("agents", {
          memberId,
          claudeSessionId: handle,
          machine: "m",
          repo: "r",
          branch: "b",
          status: "active",
          lastSeenAt: 0,
        }),
      );
    }
    return ids;
  });
  if (!noah || !ash) throw new Error("agents");
  const base = { files: [], touches: [], references: [], at: Date.now() };
  await t.run((ctx) =>
    ctx.db.insert("nodes", {
      ...base,
      agentId: noah,
      kind: "knowledge",
      verb: "LEARN",
      topic: "api.cors",
      outcome: "succeeded",
      text: "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL: browsers reject * with credentials",
    }),
  );
  const plan = await t.run((ctx) =>
    ctx.db.insert("nodes", {
      ...base,
      agentId: ash,
      kind: "intent",
      verb: "PLAN",
      outcome: "open",
      text: "PLAN add CORS middleware to the API so the storefront can call it",
    }),
  );
  const classify = async () => {
    await t.action(internal.classify.run.classifyNode, { nodeId: plan });
    return t.run((ctx) => ctx.db.query("classifications").collect());
  };
  return { t, classify };
}

beforeEach(() => judgeCalls.mockClear());
afterEach(() => vi.unstubAllEnvs());

test("a confident pair model settles the pair and the judge is never called", async () => {
  vi.stubEnv("CLASSIFIER_PAIR_MODEL", "1");
  const { t, classify } = await setup();
  await t.mutation(internal.classify.pairModel.upload, { model: tinyModel(6) });
  const [c] = await classify();
  expect(c).toMatchObject({ relation: "repeats_failure", source: "pair_model", action: "warn" });
  expect(c?.evidence[0]).toContain("pair_model tiny-6");
  expect(judgeCalls).not.toHaveBeenCalled();
});

test("an uncertain pair escalates to the judge as before", async () => {
  vi.stubEnv("CLASSIFIER_PAIR_MODEL", "1");
  const { t, classify } = await setup();
  await t.mutation(internal.classify.pairModel.upload, { model: tinyModel(0.5) });
  const [c] = await classify();
  expect(c).toMatchObject({ source: "llm" });
  expect(judgeCalls).toHaveBeenCalledTimes(1);
});

test("with the flag off, or no model stored, the judge decides", async () => {
  const off = await setup();
  await off.t.mutation(internal.classify.pairModel.upload, { model: tinyModel(6) });
  expect((await off.classify())[0]?.source).toBe("llm");
  vi.stubEnv("CLASSIFIER_PAIR_MODEL", "1");
  const empty = await setup();
  expect((await empty.classify())[0]?.source).toBe("llm");
  expect(judgeCalls).toHaveBeenCalledTimes(2);
});

test("upload refuses a model trained on other features; rollback restores the previous one", async () => {
  const { t } = await setup();
  await expect(
    t.mutation(internal.classify.pairModel.upload, { model: tinyModel(6, FEATURE_VERSION + 1) }),
  ).rejects.toThrow(/feature version/);
  await t.mutation(internal.classify.pairModel.upload, { model: tinyModel(1) });
  await t.mutation(internal.classify.pairModel.upload, { model: tinyModel(2) });
  expect(await t.mutation(internal.classify.pairModel.rollback, {})).toEqual({ rolledBack: true });
  const current = (await t.query(internal.classify.pairModel.current, {})) as { version: string };
  expect(current.version).toBe("tiny-1");
});

test("the training export recomputes features and carries the judge verdict as teacher and gold from feedback", async () => {
  const { t, classify } = await setup();
  const [c] = await classify();
  if (!c) throw new Error("no classification");
  await t.run((ctx) => ctx.db.patch(c._id, { feedback: "confirmed" }));
  const page = await t.query(internal.classify.exportPairs.page, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(page.isDone).toBe(true);
  const row = JSON.parse(page.lines[0] ?? "{}");
  expect(row.features).toHaveLength(FEATURE_NAMES.length);
  expect(row.teacher).toMatchObject({ relation: "repeats_failure", source: "llm" });
  expect(row.judge?.relation).toBe("repeats_failure");
  expect(row.gold).toEqual({ relation: "repeats_failure", origin: "feedback" });
});
