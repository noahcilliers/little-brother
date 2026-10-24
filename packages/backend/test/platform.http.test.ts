import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import { envelope, makeT, type T } from "./platformHelpers";

const post = (t: T, path: string, body: unknown, token?: string) =>
  t.fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

async function join(t: T, handle: string): Promise<string> {
  const res = await post(t, "/join", { invite: "calhacks", handle });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function openConflict(t: T, a: Id<"agents">, b: Id<"agents">) {
  return t.run(async (ctx) => {
    const nodeId = await ctx.db.insert("nodes", {
      agentId: a,
      kind: "action",
      verb: "EDIT",
      text: "EDIT db/schema/users.ts",
      files: ["db/schema/users.ts"],
      touches: [],
      references: [],
      outcome: "open",
      at: Date.now(),
    });
    const classificationId = await ctx.db.insert("classifications", {
      nodeId,
      type: "conflict",
      relation: "textual_conflict",
      direction: "none",
      action: "serialize",
      agentIds: [a, b],
      reason: "both create users.ts",
      evidence: ["R2"],
      confidence: 0.95,
      retrievalScore: 1,
      source: "rule",
      status: "open",
      latencyMs: 1,
      at: Date.now(),
    });
    const itemId = await ctx.db.insert("inbox", {
      agentId: b,
      classificationId,
      text: "noah owns users.ts",
      action: "serialize",
      state: "queued",
      attempts: 0,
      at: Date.now(),
    });
    return { classificationId, itemId };
  });
}

const agentIds = (t: T) => t.run(async (ctx) => (await ctx.db.query("agents").collect()).map((a) => a._id));

describe("http routes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("join checks the invite, seeds vocab, stores only the token hash, and rotates", async () => {
    const t = makeT();
    expect((await post(t, "/join", { invite: "wrong", handle: "ash" })).status).toBe(403);
    const first = await join(t, "ash");
    const second = await join(t, "ash");
    expect(first).not.toEqual(second);
    const state = await t.run(async (ctx) => ({
      members: await ctx.db.query("members").collect(),
      verbs: (await ctx.db.query("verbs").collect()).length,
      types: (await ctx.db.query("eventTypes").collect()).length,
    }));
    expect(state.members).toHaveLength(1);
    expect(state.members[0]?.tokenHash).not.toContain(second);
    expect(state.verbs).toBeGreaterThan(5);
    expect(state.types).toBe(4);
    const stale = await post(t, "/hook/SessionStart", envelope("SessionStart", "a1"), first);
    expect(stale.status).toBe(401);
  });

  test("hook route validates the envelope and returns {output}", async () => {
    const t = makeT();
    const tok = await join(t, "ash");
    expect((await post(t, "/hook/SessionStart", { nope: 1 }, tok)).status).toBe(400);
    const res = await post(t, "/hook/SessionStart", envelope("SessionStart", "a1"), tok);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { output: unknown };
    expect(JSON.stringify(body.output)).toContain("team digest");
  });

  test("mcp ack applies feedback; post tools create nodes; unknown session falls back", async () => {
    const t = makeT();
    const noah = await join(t, "noah");
    const josh = await join(t, "joshua");
    await post(t, "/hook/SessionStart", envelope("SessionStart", "n1"), noah);
    await post(t, "/hook/SessionStart", envelope("SessionStart", "j1"), josh);
    const [a, b] = await agentIds(t);
    if (!a || !b) throw new Error("agents missing");
    const { classificationId, itemId } = await openConflict(t, a, b);

    const inbox = await post(t, "/mcp/inbox", { claudeSessionId: "", args: {} }, josh);
    expect(((await inbox.json()) as { text: string }).text).toContain(itemId);
    expect(
      (await post(t, "/mcp/ack", { claudeSessionId: "j1", args: { itemId, outcome: "rejected" } }, noah))
        .status,
    ).toBe(404);
    const ack = await post(
      t,
      "/mcp/ack",
      { claudeSessionId: "j1", args: { itemId, outcome: "applied" } },
      josh,
    );
    expect(ack.status).toBe(200);
    const after = await t.run(async (ctx) => ({
      item: await ctx.db.get(itemId),
      c: await ctx.db.get(classificationId),
    }));
    expect(after.item?.state).toBe("applied");
    expect(after.c?.feedback).toBe("confirmed");

    const fail = await post(
      t,
      "/mcp/report_failure",
      {
        claudeSessionId: "n1",
        args: { tried: "cors() with origin *", why: "browsers reject creds", worked: "vite proxy" },
      },
      noah,
    );
    expect(fail.status).toBe(200);
    const failed = await t.run((ctx) =>
      ctx.db
        .query("nodes")
        .withIndex("by_outcome", (q) => q.eq("outcome", "failed"))
        .first(),
    );
    expect(failed?.kind).toBe("knowledge");
    expect(failed?.text).toContain("worked: vite proxy");
    expect(
      (await post(t, "/mcp/post_decision", { claudeSessionId: "n1", args: { topic: "auth" } }, noah)).status,
    ).toBe(400);
    const status = await post(t, "/mcp/status", { claudeSessionId: "j1", args: {} }, josh);
    expect(((await status.json()) as { text: string }).text).toContain("@noah");
  });

  test("verify joins merge outcomes onto open classifications between merged branches", async () => {
    const t = makeT();
    const noah = await join(t, "noah");
    const josh = await join(t, "joshua");
    await post(t, "/hook/SessionStart", envelope("SessionStart", "n1"), noah);
    await post(t, "/hook/SessionStart", envelope("SessionStart", "j1"), josh);
    const [a, b] = await agentIds(t);
    if (!a || !b) throw new Error("agents missing");
    const { classificationId } = await openConflict(t, a, b);
    const res = await post(
      t,
      "/verify",
      {
        branches: ["n1/branch", "j1/branch"],
        passed: false,
        outputTail: "1 failed",
        conflicts: [{ a: "j1/branch", b: "n1/branch", files: ["db/schema/users.ts"] }],
      },
      noah,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toContain("1 merge_conflict");
    const c = await t.run((ctx) => ctx.db.get(classificationId));
    expect(c?.outcome).toBe("merge_conflict");
    const ev = await t.run((ctx) =>
      ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("source"), "verify"))
        .first(),
    );
    expect(ev?.files).toEqual(["db/schema/users.ts"]);
  });
});
