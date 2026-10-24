import type { Judge } from "@lb/core";
import { expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./platformHelpers";

const fakeJudge: Judge & { distill: () => Promise<string | null> } = {
  async judge(pair) {
    return {
      otherNodeId: pair.other.id,
      relation: "repeats_failure",
      direction: "new_needs_other",
      confidence: 0.82,
      evidence: ["judge: wildcard CORS with credentials already failed; use the Vite proxy"],
      source: "llm",
    };
  },
  distill: async () => null,
};

vi.mock("../convex/classify/adapters/select", () => ({
  selectEmbedder: () => null,
  selectJudge: () => fakeJudge,
}));

test("intent similar to a failure lesson → judge verdict → stale warn queued for the planner", async () => {
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
  const lesson = await t.run((ctx) =>
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
  const [c] = await t.run((ctx) => ctx.db.query("classifications").collect());
  expect(c).toMatchObject({
    type: "stale",
    relation: "repeats_failure",
    action: "warn",
    source: "llm",
    againstNodeId: lesson,
  });
  const inbox = await t.run((ctx) => ctx.db.query("inbox").collect());
  expect(inbox.map((i) => [i.agentId, i.action])).toEqual([[ash, "warn"]]);
  expect(inbox[0]?.text).toContain("worked: FIX api.cors web/vite.config.ts");
});
