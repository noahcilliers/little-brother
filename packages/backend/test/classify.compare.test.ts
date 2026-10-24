import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const distill = vi.fn(
  async (_prompt: string) => "noah: JWT bearer\njoshua: session cookie\nmatches: no decision yet",
);

vi.mock("../convex/classify/adapters/select", () => ({
  selectEmbedder: () => null,
  selectJudge: () => ({ judge: async () => null, distill }),
}));

const modules = import.meta.glob("../convex/**/*.ts");

test("an open escalation gets one side-by-side comparison once both sides have working code", async () => {
  const t = convexTest(schema, modules);
  const ids: Id<"agents">[] = await t.run(async (ctx) => {
    const out = [];
    for (const handle of ["noah", "joshua"]) {
      const memberId = await ctx.db.insert("members", {
        name: handle,
        handle,
        tokenHash: handle,
        revoked: false,
      });
      out.push(
        await ctx.db.insert("agents", {
          memberId,
          claudeSessionId: handle,
          machine: "m",
          repo: "r",
          branch: "b",
          status: "active",
          lastSeenAt: Date.now(),
        }),
      );
    }
    return out;
  });
  const [noah, joshua] = ids;
  if (!noah || !joshua) throw new Error("agents");
  const node = (agentId: Id<"agents">, text: string, file: string, outcome: "open" | "succeeded") =>
    t.run((ctx) =>
      ctx.db.insert("nodes", {
        agentId,
        kind: "action",
        verb: "EDIT",
        text,
        files: [file],
        touches: [],
        references: [],
        outcome,
        at: Date.now(),
      }),
    );
  const jwt = await node(
    noah,
    "EDIT auth.mechanism src/auth/issue-token.ts jwt.sign",
    "src/auth/issue-token.ts",
    "succeeded",
  );
  const session = await node(
    joshua,
    "EDIT src/checkout/session.ts req.session.userId",
    "src/checkout/session.ts",
    "open",
  );
  const cId = await t.run((ctx) =>
    ctx.db.insert("classifications", {
      nodeId: jwt,
      againstNodeId: session,
      type: "conflict",
      relation: "intent_contradiction",
      direction: "none",
      action: "block",
      agentIds: [noah, joshua],
      reason: "[little-brother] conflict · jwt.sign bearer vs req.session.userId",
      evidence: [],
      confidence: 0.86,
      retrievalScore: 0.9,
      source: "llm",
      status: "open",
      latencyMs: 900,
      at: Date.now(),
    }),
  );

  // Only one side has working code yet: no comparison.
  await t.action(internal.classify.run.classifyNode, { nodeId: jwt });
  expect(distill).not.toHaveBeenCalled();

  await t.run((ctx) => ctx.db.patch(session, { outcome: "succeeded" }));
  await t.action(internal.classify.run.classifyNode, { nodeId: session });
  await t.action(internal.classify.run.classifyNode, { nodeId: jwt });
  expect(distill).toHaveBeenCalledTimes(1);
  expect(distill.mock.calls[0]?.[0]).toContain("req.session.userId");
  const row = await t.run((ctx) => ctx.db.get(cId));
  expect(row?.comparison).toBe("noah: JWT bearer\njoshua: session cookie\nmatches: no decision yet");
});
