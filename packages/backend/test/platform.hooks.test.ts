import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { envelope, hook, joinMember, makeT, type T } from "./platformHelpers";

async function agentOf(t: T, session: string) {
  const agent = await t.run((ctx) =>
    ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("claudeSessionId", session))
      .first(),
  );
  if (!agent) throw new Error("no agent");
  return agent;
}

async function queueItem(
  t: T,
  agentId: Id<"agents">,
  nodeId: Id<"nodes">,
  action: "warn" | "serialize" | "block",
) {
  return t.run(async (ctx) => {
    const classificationId = await ctx.db.insert("classifications", {
      nodeId,
      type: action === "warn" ? "stale" : "conflict",
      relation: action === "warn" ? "repeats_failure" : "intent_contradiction",
      direction: "none",
      action,
      agentIds: [agentId],
      reason: "auth.mechanism: jwt vs cookie",
      evidence: ["noah switched to jwt"],
      confidence: 0.9,
      retrievalScore: 0.9,
      source: "rule",
      status: "open",
      latencyMs: 1,
      at: Date.now(),
    });
    return ctx.db.insert("inbox", {
      agentId,
      classificationId,
      text: `${action}: auth uses jwt now`,
      action,
      state: "queued",
      attempts: 0,
      at: Date.now(),
    });
  });
}

describe("hook ingest", () => {
  // Scheduled classifier actions belong to another workstream; keep them from firing mid-test.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("rejects unknown tokens", async () => {
    const t = makeT();
    const res = await hook(t, "nope", envelope("SessionStart", "s0"));
    expect(res.status).toBe(401);
  });

  test("SessionStart creates the agent and returns a digest naming teammates", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const ash = await joinMember(t, "ash");
    await hook(t, noah, envelope("SessionStart", "n1"));
    await hook(t, noah, envelope("UserPromptSubmit", "n1", { prompt: "switch auth to JWT" }));
    const res = await hook(t, ash, envelope("SessionStart", "a1"));
    const text = JSON.stringify(res.output);
    expect(text).toContain("@noah");
    expect(text).toContain("switch auth to JWT");
    expect(text).toContain("A denied edit says who owns the work");
    expect((await agentOf(t, "a1")).status).toBe("active");
  });

  test("is idempotent on eventKey", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    const env = envelope("UserPromptSubmit", "a1", { prompt: "add cors" });
    const first = await hook(t, tok, env);
    const second = await hook(t, tok, env);
    expect(second).toEqual(first);
    const counts = await t.run(async (ctx) => ({
      events: (await ctx.db.query("events").collect()).length,
      nodes: (await ctx.db.query("nodes").collect()).length,
    }));
    expect(counts).toEqual({ events: 1, nodes: 1 });
  });

  test("UserPromptSubmit creates an intent and delivers queued items", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    await hook(t, tok, envelope("UserPromptSubmit", "a1", { prompt: "build checkout" }));
    const agent = await agentOf(t, "a1");
    if (!agent.intentId) throw new Error("no intent");
    const intent = await t.run((ctx) => ctx.db.get(agent.intentId as Id<"nodes">));
    expect(intent?.text).toBe("PLAN build checkout");
    const itemId = await queueItem(t, agent._id, agent.intentId, "warn");
    const res = await hook(t, tok, envelope("UserPromptSubmit", "a1", { prompt: "continue" }));
    expect(JSON.stringify(res.output)).toContain("warn: auth uses jwt now");
    expect(JSON.stringify(res.output)).not.toContain(itemId);
    expect((await t.run((ctx) => ctx.db.get(itemId)))?.state).toBe("delivered");
  });

  test("PreToolUse records an action under the intent; PostToolUse closes it and injects warnings", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    await hook(t, tok, envelope("UserPromptSubmit", "a1", { prompt: "run tests" }));
    const pre = await hook(
      t,
      tok,
      envelope("PreToolUse", "a1", { tool: "Bash", command: "pnpm vitest run" }),
    );
    expect(pre.output).toBeNull();
    const agent = await agentOf(t, "a1");
    const action = await t.run((ctx) =>
      ctx.db
        .query("nodes")
        .filter((q) => q.eq(q.field("kind"), "action"))
        .first(),
    );
    expect(action?.verb).toBe("TEST");
    expect(action?.parentId).toBe(agent.intentId);
    if (!action) throw new Error("no action");
    const itemId = await queueItem(t, agent._id, action._id, "warn");
    const post = await hook(
      t,
      tok,
      envelope("PostToolUse", "a1", { tool: "Bash", command: "pnpm vitest run", exitCode: 1 }),
    );
    expect(JSON.stringify(post.output)).toContain("warn: auth uses jwt now");
    const updated = await t.run((ctx) => ctx.db.get(action._id));
    expect(updated?.outcome).toBe("failed");
    expect(updated?.text).toContain("→ FAIL");
  });

  test("Read arrives only as PostToolUse and becomes a silent EXPLORE node", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    const res = await hook(t, tok, envelope("PostToolUse", "a1", { tool: "Read", files: ["src/a.ts"] }));
    expect(res.output).toBeNull();
    const node = await t.run((ctx) => ctx.db.query("nodes").first());
    expect(node?.verb).toBe("EXPLORE");
  });

  test("Stop holds the agent once for an undecided blocking conflict, then closes the intent as failed", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    await hook(t, tok, envelope("UserPromptSubmit", "a1", { prompt: "add cors" }));
    await hook(t, tok, envelope("PreToolUse", "a1", { tool: "Bash", command: "vitest" }));
    await hook(t, tok, envelope("PostToolUseFailure", "a1", { tool: "Bash", command: "vitest" }));
    const agent = await agentOf(t, "a1");
    const intentId = agent.intentId as Id<"nodes">;
    await queueItem(t, agent._id, intentId, "block");
    const first = await hook(t, tok, envelope("Stop", "a1"));
    expect(first.output).toMatchObject({ decision: "block" });
    expect(JSON.stringify(first.output)).not.toContain("ack");
    const second = await hook(t, tok, envelope("Stop", "a1", { tokens: 1234 }));
    expect(second.output).toBeNull();
    const intent = await t.run((ctx) => ctx.db.get(intentId));
    expect(intent?.outcome).toBe("failed");
    const stopEvent = await t.run((ctx) =>
      ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("tokens"), 1234))
        .first(),
    );
    expect(stopEvent?.hook).toBe("Stop");
  });

  test("Stop respects stopHookActive", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    await hook(t, tok, envelope("UserPromptSubmit", "a1", { prompt: "x" }));
    const agent = await agentOf(t, "a1");
    await queueItem(t, agent._id, agent.intentId as Id<"nodes">, "serialize");
    const res = await hook(t, tok, envelope("Stop", "a1", { stopHookActive: true }));
    expect(res.output).toBeNull();
  });

  test("inbox:watch returns queued urgent items for the token's own agent", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    await hook(t, tok, envelope("UserPromptSubmit", "a1", { prompt: "x" }));
    const agent = await agentOf(t, "a1");
    const intentId = agent.intentId as Id<"nodes">;
    const blockId = await queueItem(t, agent._id, intentId, "block");
    await queueItem(t, agent._id, intentId, "warn");
    const items = await t.query(api.inbox.watch, { token: tok, claudeSessionId: "a1" });
    expect(items).toEqual([
      { id: blockId, text: "block: auth uses jwt now", action: "block", kind: "conflict" },
    ]);
    expect(await t.query(api.inbox.watch, { token: "wrong", claudeSessionId: "a1" })).toEqual([]);
    await t.mutation(api.inbox.markDelivered, { token: tok, ids: [blockId] });
    expect(await t.query(api.inbox.watch, { token: tok, claudeSessionId: "a1" })).toEqual([]);
  });

  test("SessionEnd marks the agent offline", async () => {
    const t = makeT();
    const tok = await joinMember(t, "ash");
    await hook(t, tok, envelope("SessionEnd", "a1"));
    expect((await agentOf(t, "a1")).status).toBe("offline");
  });
});
