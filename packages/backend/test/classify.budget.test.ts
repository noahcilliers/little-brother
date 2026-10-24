import type { Judge } from "@lb/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT, type T } from "./platformHelpers";

// Read once when the budget module loads, so set before any function runs.
vi.stubEnv("JUDGE_CALLS_PER_MINUTE", "5");
vi.stubEnv("JUDGE_CALLS_PER_DAY", "6");

const judge = vi.fn<Judge["judge"]>(async (pair) => ({
  otherNodeId: pair.other.id,
  relation: "repeats_failure",
  direction: "new_needs_other",
  confidence: 0.82,
  evidence: ["judge: wildcard CORS with credentials already failed"],
  source: "llm",
}));

vi.mock("../convex/classify/adapters/select", () => ({
  selectEmbedder: () => null,
  selectJudge: () => ({ judge, distill: async () => null }),
}));

const admit = (t: T, calls: number) => t.mutation(internal.classify.budget.admit, { calls });

let t: T;
beforeEach(() => {
  vi.useFakeTimers();
  t = makeT();
  judge.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("judge call limits", () => {
  test("a refusal by one limit spends neither", async () => {
    expect(await admit(t, 4)).toEqual({ ok: true });
    // 6 fits the day but not the minute; the day must not be charged for it.
    expect(await admit(t, 2)).toMatchObject({ ok: false, limit: "minute" });
    expect(await admit(t, 1)).toEqual({ ok: true });
    const day = await admit(t, 2);
    expect(day).toMatchObject({ ok: false, limit: "day" });
    expect(day.ok || day.retryAfter > 0).toBe(true);
  });

  test("over the limit, the classifier skips the judge instead of calling it", async () => {
    expect(await admit(t, 4)).toEqual({ ok: true });
    expect(await admit(t, 1)).toEqual({ ok: true });
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
        text: "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL: browsers reject * with credentials → worked: FIX api.cors web/vite.config.ts",
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
    await t.action(internal.classify.run.classifyNode, { nodeId: plan });
    expect(judge).not.toHaveBeenCalled();
    const llm = await t.run(async (ctx) =>
      (await ctx.db.query("classifications").collect()).filter((c) => c.source === "llm"),
    );
    expect(llm).toEqual([]);
  });
});
