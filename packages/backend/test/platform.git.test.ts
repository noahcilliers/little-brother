import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { sha256Hex } from "../convex/hash";
import { envelope, hook, joinMember, makeT, type T } from "./platformHelpers";

const SHA = "abc1234def5678";

async function agentOf(t: T, session: string) {
  const agent = await t.run((ctx) =>
    ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("claudeSessionId", session))
      .first(),
  );
  if (!agent) throw new Error(`no agent ${session}`);
  return agent;
}

function actionNode(t: T, agentId: Id<"agents">, files: string[]) {
  return t.run((ctx) =>
    ctx.db.insert("nodes", {
      agentId,
      kind: "action",
      verb: "EDIT",
      text: `EDIT ${files.join(" ")}`,
      files,
      touches: [],
      references: [],
      outcome: "succeeded",
      at: Date.now(),
    }),
  );
}

function verdict(t: T, nodeId: Id<"nodes">, againstNodeId: Id<"nodes">, agentIds: Id<"agents">[]) {
  return t.run((ctx) =>
    ctx.db.insert("classifications", {
      nodeId,
      againstNodeId,
      type: "conflict",
      relation: "same_symbol_edit",
      direction: "none",
      action: "serialize",
      agentIds,
      reason: "[little-brother] conflict · both edit src/cart.ts",
      evidence: [],
      confidence: 0.9,
      retrievalScore: 1,
      source: "rule",
      status: "open",
      latencyMs: 1,
      at: Date.now(),
    }),
  );
}

const bash = (session: string, command: string, git: Record<string, unknown>) =>
  envelope("PostToolUse", session, {
    tool: "Bash",
    command,
    exitCode: 0,
    git: { files: [], ...git } as never,
  });

async function verify(t: T, token: string, body: unknown) {
  return t.mutation(internal.verify.record, { tokenHash: await sha256Hex(token), body });
}

async function inboxOf(t: T, agentId: Id<"agents">) {
  return t.run((ctx) =>
    ctx.db
      .query("inbox")
      .withIndex("by_agent_state", (q) => q.eq("agentId", agentId))
      .collect(),
  );
}

describe("git awareness", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("baseRev lands on the agent and its action nodes", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    await hook(t, noah, envelope("SessionStart", "n1"));
    await hook(
      t,
      noah,
      envelope("PreToolUse", "n1", {
        tool: "Edit",
        toolUseId: "e1",
        files: ["src/cart.ts"],
        baseRev: "base111",
      }),
    );
    const agent = await agentOf(t, "n1");
    expect(agent.baseRev).toBe("base111");
    const node = await t.run((ctx) =>
      ctx.db
        .query("nodes")
        .withIndex("by_tool_use", (q) => q.eq("toolUseId", "e1"))
        .first(),
    );
    expect(node?.baseRev).toBe("base111");
  });

  test("commit then push releases the held claim and tells the waiting agent once", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const josh = await joinMember(t, "joshua");
    await hook(t, noah, envelope("SessionStart", "n1"));
    await hook(t, josh, envelope("SessionStart", "j1"));
    const n = await agentOf(t, "n1");
    const j = await agentOf(t, "j1");
    const held = await actionNode(t, n._id, ["src/cart.ts"]);
    const other = await actionNode(t, n._id, ["README.md"]);
    const waiting = await actionNode(t, j._id, ["src/cart.ts"]);
    const cId = await verdict(t, waiting, held, [j._id, n._id]);

    await hook(
      t,
      noah,
      bash("n1", "git commit -m cart", { op: "commit", ok: true, sha: SHA, files: ["src/cart.ts"] }),
    );
    expect((await t.run((ctx) => ctx.db.get(held)))?.landed).toBe("committed");
    expect((await t.run((ctx) => ctx.db.get(other)))?.landed).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(cId)))?.status).toBe("open");

    await hook(
      t,
      noah,
      bash("n1", "git push", {
        op: "push",
        ok: true,
        sha: SHA,
        branch: "n1/branch",
        target: "origin/n1/branch",
      }),
    );
    expect((await t.run((ctx) => ctx.db.get(held)))?.landed).toBe("pushed");
    const c = await t.run((ctx) => ctx.db.get(cId));
    expect(c).toMatchObject({ status: "resolved", resolution: "landed: push abc1234" });
    expect((await agentOf(t, "n1")).git).toMatchObject({
      op: "push",
      ok: true,
      sha: SHA,
      target: "origin/n1/branch",
    });
    const items = await inboxOf(t, j._id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ action: "warn", state: "queued" });
    expect(items[0]?.text).toBe(
      "@noah pushed src/cart.ts (abc1234); you can build on it now — pull n1/branch or wait for merge.",
    );

    await hook(
      t,
      noah,
      bash("n1", "git push", { op: "push", ok: true, sha: SHA, target: "origin/n1/branch" }),
    );
    expect(await inboxOf(t, j._id)).toHaveLength(1);

    const res = await hook(
      t,
      josh,
      envelope("PostToolUse", "j1", { tool: "Bash", command: "ls", exitCode: 0 }),
    );
    expect(JSON.stringify(res.output)).toContain("you can build on it now");
  });

  test("a push to main marks committed work merged; failed ops change nothing", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    await hook(t, noah, envelope("SessionStart", "n1"));
    const n = await agentOf(t, "n1");
    const node = await actionNode(t, n._id, ["src/cart.ts"]);
    await hook(t, noah, bash("n1", "git commit -m x", { op: "commit", ok: false, files: [] }));
    expect((await t.run((ctx) => ctx.db.get(node)))?.landed).toBeUndefined();
    expect((await agentOf(t, "n1")).git).toMatchObject({ op: "commit", ok: false });
    await hook(
      t,
      noah,
      bash("n1", "git commit -am x && git push origin HEAD:main", {
        op: "push",
        ok: true,
        sha: SHA,
        target: "origin/main",
        files: ["src/cart.ts"],
      }),
    );
    expect((await t.run((ctx) => ctx.db.get(node)))?.landed).toBe("merged");
  });

  test("verify: an unflagged git conflict becomes a missed verdict queued for both agents", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const josh = await joinMember(t, "joshua");
    await hook(t, noah, envelope("SessionStart", "n1"));
    await hook(t, josh, envelope("SessionStart", "j1"));
    const n = await agentOf(t, "n1");
    const j = await agentOf(t, "j1");
    const nNode = await actionNode(t, n._id, ["db/schema.ts"]);
    const jNode = await actionNode(t, j._id, ["db/schema.ts"]);
    const body = {
      branches: ["n1/branch", "j1/branch"],
      passed: false,
      outputTail: "",
      conflicts: [{ a: "n1/branch", b: "j1/branch", files: ["db/schema.ts"] }],
    };
    const res = await verify(t, noah, body);
    expect(res.text).toContain("1 missed");
    const all = await t.run((ctx) => ctx.db.query("classifications").collect());
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      type: "conflict",
      relation: "textual_conflict",
      source: "rule",
      action: "serialize",
      gitStatus: "missed",
      outcome: "merge_conflict",
      nodeId: nNode,
      againstNodeId: jNode,
      agentIds: [n._id, j._id],
    });
    expect(all[0]?.reason).toBe(
      "[little-brother] conflict · git merge-tree: n1/branch and j1/branch both change db/schema.ts (found by lb verify, missed live)",
    );
    for (const id of [n._id, j._id]) {
      const items = await inboxOf(t, id);
      expect(items.map((i) => i.action)).toEqual(["serialize"]);
    }
    // The Stop hook's background check re-finding it neither duplicates nor relabels it.
    await verify(t, josh, { ...body, passed: true, background: true });
    const again = await t.run((ctx) => ctx.db.query("classifications").collect());
    expect(again).toHaveLength(1);
    expect(again[0]?.gitStatus).toBe("missed");
    // The dashboard reads these keys off verify events to label background merge-tree runs.
    const events = await t.run((ctx) =>
      ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("source"), "verify"))
        .collect(),
    );
    expect(events.map((e) => e.payload.background)).toEqual([undefined, true]);
    expect(events[1]?.payload).toMatchObject({
      branches: body.branches,
      passed: true,
      conflicts: body.conflicts,
    });
  });

  test("verify: a predicted conflict is confirmed; a clean passing merge labels clean, background never does", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const josh = await joinMember(t, "joshua");
    await hook(t, noah, envelope("SessionStart", "n1"));
    await hook(t, josh, envelope("SessionStart", "j1"));
    const n = await agentOf(t, "n1");
    const j = await agentOf(t, "j1");
    const a = await actionNode(t, n._id, ["src/cart.ts"]);
    const b = await actionNode(t, j._id, ["src/cart.ts"]);
    const cId = await verdict(t, b, a, [j._id, n._id]);

    const branches = ["n1/branch", "j1/branch"];
    await verify(t, noah, { branches, passed: true, outputTail: "bg", conflicts: [], background: true });
    expect((await t.run((ctx) => ctx.db.get(cId)))?.gitStatus).toBeUndefined();

    await verify(t, noah, { branches, passed: true, outputTail: "ok", conflicts: [] });
    expect((await t.run((ctx) => ctx.db.get(cId)))?.gitStatus).toBe("clean");

    await verify(t, noah, {
      branches,
      passed: false,
      outputTail: "",
      conflicts: [{ a: "j1/branch", b: "n1/branch", files: ["src/cart.ts"] }],
    });
    const c = await t.run((ctx) => ctx.db.get(cId));
    expect(c).toMatchObject({ gitStatus: "confirmed", outcome: "merge_conflict" });
    expect(await t.run((ctx) => ctx.db.query("classifications").collect())).toHaveLength(1);
  });

  test("/mcp/branches lists other active agents' branches in the same repo", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const josh = await joinMember(t, "joshua");
    await hook(t, noah, envelope("SessionStart", "n1"));
    await hook(t, josh, envelope("SessionStart", "j1"));
    const res = await t.mutation(internal.mcp.call, {
      tokenHash: await sha256Hex(noah),
      tool: "branches",
      claudeSessionId: "n1",
      args: {},
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.text)).toEqual([{ handle: "joshua", branch: "j1/branch" }]);
  });
});
