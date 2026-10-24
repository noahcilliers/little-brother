import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { loadStructural } from "../convex/classify/load";
import { runSyncChecks } from "../convex/classify/sync";
import { insertNode } from "../convex/nodes";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
type T = ReturnType<typeof convexTest>;
type Room = { teamId: Id<"teams">; sessionId: Id<"sessions"> };

async function room(ctx: MutationCtx, name: string): Promise<Room> {
  const teamId = await ctx.db.insert("teams", { name, inviteCode: name, createdAt: 0 });
  const memberId = await ctx.db.insert("members", { name, handle: name, tokenHash: name, revoked: false });
  const sessionId = await ctx.db.insert("sessions", {
    teamId,
    name,
    code: name,
    createdBy: memberId,
    createdAt: 0,
  });
  return { teamId, sessionId };
}

async function agent(ctx: MutationCtx, r: Room, handle: string): Promise<Id<"agents">> {
  const memberId = await ctx.db.insert("members", {
    name: handle,
    handle,
    tokenHash: handle,
    revoked: false,
  });
  return ctx.db.insert("agents", {
    ...r,
    memberId,
    claudeSessionId: `s-${handle}`,
    machine: "m",
    repo: "shop",
    branch: handle,
    status: "active",
    lastSeenAt: Date.now(),
  });
}

const edit = (agentId: Id<"agents">, file: string, outcome: "open" | "failed" = "open") => ({
  agentId,
  kind: "action" as const,
  verb: "EDIT",
  text: `EDIT ${file}`,
  files: [file],
  touches: [{ path: file, op: "create" as const, lines: [1, 20] as [number, number] }],
  outcome,
  at: Date.now(),
});

let t: T;
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  t = convexTest(schema, modules);
});
afterEach(() => vi.unstubAllEnvs());

describe("hot-path retrieval scope", () => {
  test("a busy session elsewhere does not push a teammate's clash out of view", async () => {
    const judgments = await t.run(async (ctx) => {
      const mine = await room(ctx, "mine");
      const busy = await room(ctx, "busy");
      const noah = await agent(ctx, mine, "noah");
      const joshua = await agent(ctx, mine, "joshua");
      const stranger = await agent(ctx, busy, "stranger");
      await insertNode(ctx, edit(noah, "db/users.ts"));
      // More open work than the old deployment-wide window (200 rows) held, all newer than noah's.
      for (let i = 0; i < 250; i++) await insertNode(ctx, edit(stranger, `other/${i}.ts`));
      return runSyncChecks(ctx, await insertNode(ctx, edit(joshua, "db/users.ts")));
    });
    expect(judgments[0]).toMatchObject({ relation: "textual_conflict" });
  });

  test("reads only this session's peers and this room's failures", async () => {
    const loaded = await t.run(async (ctx) => {
      const mine = await room(ctx, "mine");
      const other = await room(ctx, "other");
      const noah = await agent(ctx, mine, "noah");
      const joshua = await agent(ctx, mine, "joshua");
      const stranger = await agent(ctx, other, "stranger");
      const peerWork = await insertNode(ctx, edit(noah, "a.ts"));
      const ownFailure = await insertNode(ctx, edit(joshua, "b.ts", "failed"));
      await insertNode(ctx, edit(stranger, "b.ts"));
      await insertNode(ctx, edit(stranger, "b.ts", "failed"));
      const nextId = await insertNode(ctx, edit(joshua, "b.ts"));
      const next = await ctx.db.get(nextId);
      if (!next) throw new Error("no node");
      const nodes = await loadStructural(ctx, next, Date.now());
      return { ids: nodes.map((n) => n._id), peerWork, ownFailure, teamId: next.teamId, room: mine.teamId };
    });
    expect(loaded.teamId).toBe(loaded.room);
    expect(new Set(loaded.ids)).toEqual(new Set([loaded.peerWork, loaded.ownFailure]));
  });
});
