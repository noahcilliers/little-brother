import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { runSyncChecks } from "../convex/classify/sync";
import { insertNode } from "../convex/nodes";
import { makeT, type T } from "./platformHelpers";

let t: T;
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("LB_ALLOW_INVITE", "1");
  t = makeT();
});
afterEach(() => vi.unstubAllEnvs());

async function pair(ctx: MutationCtx): Promise<Id<"agents">[]> {
  const teamId = await ctx.db.insert("teams", { name: "r", inviteCode: "r", createdAt: 0 });
  const ids: Id<"agents">[] = [];
  for (const handle of ["noah", "ash"]) {
    const memberId = await ctx.db.insert("members", {
      name: handle,
      handle,
      tokenHash: handle,
      revoked: false,
    });
    const sessionId =
      ids.length === 0
        ? await ctx.db.insert("sessions", { teamId, name: "s", code: "s", createdBy: memberId, createdAt: 0 })
        : ((await ctx.db.get(ids[0] as Id<"agents">))?.sessionId ?? undefined);
    ids.push(
      await ctx.db.insert("agents", {
        teamId,
        ...(sessionId ? { sessionId } : {}),
        memberId,
        claudeSessionId: handle,
        machine: "m",
        repo: "shop",
        branch: handle,
        status: "active",
        lastSeenAt: Date.now(),
      }),
    );
  }
  return ids;
}

// Steps carry their goal (the prompt they serve): that is what keeps one catch across retries.
const create = (agentId: Id<"agents">, parentId: Id<"nodes">) => ({
  agentId,
  parentId,
  kind: "action" as const,
  verb: "EDIT",
  text: "EDIT src/db/users.ts",
  files: ["src/db/users.ts"],
  touches: [{ path: "src/db/users.ts", op: "create" as const, lines: [1, 20] as [number, number] }],
  outcome: "open",
  at: Date.now(),
});

/** One catch between noah's and ash's work, as the hot path stores it. */
async function caught() {
  return t.run(async (ctx) => {
    const [noah, ash] = await pair(ctx);
    if (!noah || !ash) throw new Error("agents");
    const goal = (agentId: Id<"agents">) =>
      insertNode(ctx, {
        agentId,
        kind: "intent",
        verb: "PLAN",
        text: "PLAN users table",
        outcome: "open",
        files: [],
        at: Date.now(),
      });
    const goals = { noah: await goal(noah), ash: await goal(ash) };
    await insertNode(ctx, create(noah, goals.noah));
    await runSyncChecks(ctx, await insertNode(ctx, create(ash, goals.ash)));
    const row = await ctx.db.query("classifications").first();
    if (!row) throw new Error("no catch");
    return { noah, ash, row, goals };
  });
}

test("letting both continue settles the catch, records who, and tells both agents", async () => {
  const { row } = await caught();
  await t.mutation(api.resolve.release, { classificationId: row._id });
  const after = await t.run(async (ctx) => ({
    c: await ctx.db.get(row._id),
    inbox: await ctx.db.query("inbox").collect(),
  }));
  expect(after.c).toMatchObject({
    status: "resolved",
    outcome: "human_release",
    resolvedBy: "the dashboard",
  });
  expect(after.c?.resolvedAt).toBeTypeOf("number");
  const released = after.inbox.filter((i) => i.text.includes("released"));
  expect(new Set(released.map((i) => i.agentId))).toEqual(new Set(row.agentIds));
  await expect(t.mutation(api.resolve.dismiss, { classificationId: row._id })).rejects.toThrow(
    /already resolved/,
  );
});

test("dismissing tells the agents to go ahead, and the next step of the same work is not caught again", async () => {
  const { ash, row, goals } = await caught();
  await t.mutation(api.resolve.dismiss, { classificationId: row._id });
  const retry = await t.run(async (ctx) => runSyncChecks(ctx, await insertNode(ctx, create(ash, goals.ash))));
  expect(retry.judgments.filter((j) => j.action === "block" || j.action === "serialize")).toEqual([]);
  const rows = await t.run((ctx) => ctx.db.query("classifications").collect());
  expect(rows.filter((r) => r.status === "open" && r.type !== "normal")).toEqual([]);
  const cleared = await t.run((ctx) => ctx.db.query("inbox").collect());
  expect(cleared.some((i) => i.agentId === ash && i.text.includes("cleared"))).toBe(true);
});
