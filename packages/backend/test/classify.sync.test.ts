import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { runSyncChecks } from "../convex/classify/sync";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
type T = ReturnType<typeof convexTest>;
type NodeIn = Partial<Omit<Doc<"nodes">, "_id" | "_creationTime">> & { agentId: Id<"agents"> };

const DEMO_TOPICS = {
  topics: {
    "db.users": { owner: "noah", files: ["db/schema/users.ts"], consumers: ["src/checkout/**"] },
    "auth.mechanism": {
      owner: "noah",
      files: ["src/auth/**"],
      consumers: ["src/checkout/**", "web/src/api.ts"],
    },
    "api.cors": {
      owner: "noah",
      files: ["src/server.ts", "web/vite.config.ts"],
      consumers: ["web/src/api.ts"],
    },
  },
};

async function agent(t: T, handle: string): Promise<Id<"agents">> {
  return t.run(async (ctx) => {
    const memberId = await ctx.db.insert("members", {
      name: handle,
      handle,
      tokenHash: handle,
      revoked: false,
    });
    return ctx.db.insert("agents", {
      memberId,
      claudeSessionId: `s-${handle}`,
      machine: "m",
      repo: "lb-demo-shop",
      branch: `${handle}/x`,
      status: "active",
      lastSeenAt: Date.now(),
    });
  });
}

function insert(t: T, n: NodeIn): Promise<Id<"nodes">> {
  return t.run((ctx) =>
    ctx.db.insert("nodes", {
      kind: "action",
      verb: "EDIT",
      text: "EDIT",
      files: [],
      touches: [],
      references: [],
      outcome: "open",
      at: Date.now(),
      ...n,
    }),
  );
}

const sync = (t: T, id: Id<"nodes">) => t.run((ctx) => runSyncChecks(ctx, id).then((r) => r.judgments));
const rows = (t: T) =>
  t.run(async (ctx) => ({
    classifications: await ctx.db.query("classifications").collect(),
    inbox: await ctx.db.query("inbox").collect(),
  }));

let t: T;
let noah: Id<"agents">;
let joshua: Id<"agents">;
let ash: Id<"agents">;

beforeEach(async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  t = convexTest(schema, modules);
  noah = await agent(t, "noah");
  joshua = await agent(t, "joshua");
  ash = await agent(t, "ash");
  await t.run((ctx) => ctx.db.insert("settings", { key: "topics:lb-demo-shop", value: DEMO_TOPICS }));
});
afterEach(() => vi.unstubAllEnvs());

describe("runSyncChecks", () => {
  test("two agents create db/schema/users.ts → textual_conflict, serialize, shown as duplicate", async () => {
    await insert(t, {
      agentId: noah,
      text: "EDIT db.users db/schema/users.ts",
      topic: "db.users",
      files: ["db/schema/users.ts"],
      touches: [{ path: "db/schema/users.ts", op: "create", lines: [1, 30] }],
      references: ["src/contracts/user.ts::User"],
      signature: "sig-noah-users",
    });
    const mine = await insert(t, {
      agentId: joshua,
      text: "EDIT db.users db/schema/users.ts",
      topic: "db.users",
      files: ["db/schema/users.ts"],
      touches: [{ path: "db/schema/users.ts", op: "create", lines: [1, 20] }],
      signature: "sig-joshua-users",
    });
    const js = await sync(t, mine);
    expect(js).toHaveLength(1);
    expect(js[0]).toMatchObject({
      relation: "textual_conflict",
      action: "serialize",
      type: "duplicate",
      source: "rule",
    });
    const { classifications, inbox } = await rows(t);
    expect(classifications).toHaveLength(1);
    expect(classifications[0]).toMatchObject({
      type: "duplicate",
      action: "serialize",
      agentIds: [joshua, noah],
    });
    expect(classifications[0]?.reason).toContain("noah (agent active)");
    expect(classifications[0]?.reason).toContain("import User from src/contracts/user.ts instead");
    // Joshua learns through the deny; Noah, who owns the file, has nothing to do, so nobody gets an inbox item.
    expect(inbox).toEqual([]);

    // Re-running the same check does not duplicate rows or alerts.
    await sync(t, mine);
    const again = await rows(t);
    expect(again.classifications).toHaveLength(1);
    expect(again.inbox).toHaveLength(0);
  });

  test("exact repeat of another agent's failed CORS edit → repeats_failure, stale, serialize", async () => {
    await insert(t, {
      agentId: noah,
      kind: "knowledge",
      verb: "LEARN",
      text: "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL: browsers reject * with credentials → worked: FIX api.cors web/vite.config.ts",
      topic: "api.cors",
      files: ["src/server.ts", "web/vite.config.ts"],
      outcome: "succeeded",
      signature: "sig-cors",
      at: Date.now() - 3 * 60 * 60 * 1000,
    });
    const mine = await insert(t, {
      agentId: ash,
      text: "EDIT api.cors src/server.ts",
      topic: "api.cors",
      files: ["src/server.ts"],
      touches: [{ path: "src/server.ts", op: "write", lines: [1, 12] }],
      signature: "sig-cors",
    });
    const js = await sync(t, mine);
    expect(js[0]).toMatchObject({ relation: "repeats_failure", action: "serialize" });
    const { classifications, inbox } = await rows(t);
    expect(classifications[0]).toMatchObject({ type: "stale", relation: "repeats_failure" });
    expect(classifications[0]?.reason).toContain("worked: FIX api.cors web/vite.config.ts");
    expect(classifications[0]?.reason).toContain("exact repeat of a known-failing edit");
    expect(inbox).toEqual([]); // the author of a lesson is not notified
  });

  test("a plan matching a failed signature only warns, queued for the planner", async () => {
    await insert(t, {
      agentId: noah,
      verb: "RUN",
      text: "RUN deploy → FAIL",
      outcome: "failed",
      signature: "sig-run",
    });
    const plan = await insert(t, {
      agentId: ash,
      kind: "intent",
      verb: "PLAN",
      text: "PLAN deploy",
      signature: "sig-run",
    });
    const js = await sync(t, plan);
    expect(js[0]).toMatchObject({ relation: "repeats_failure", action: "warn" });
    const { inbox } = await rows(t);
    expect(inbox.map((i) => [i.agentId, i.action])).toEqual([[ash, "warn"]]);
  });

  test("signature change of a function another agent calls → semantic_conflict, block both sides", async () => {
    await insert(t, {
      agentId: joshua,
      text: "EDIT checkout src/checkout/pay-flow.ts",
      files: ["src/checkout/pay-flow.ts"],
      touches: [{ path: "src/checkout/pay-flow.ts", op: "write", lines: [5, 9] }],
      references: ["src/billing/pay.ts::pay"],
    });
    const mine = await insert(t, {
      agentId: noah,
      text: "EDIT billing src/billing/pay.ts",
      files: ["src/billing/pay.ts"],
      touches: [
        {
          path: "src/billing/pay.ts",
          symbol: "src/billing/pay.ts::pay",
          op: "signature_change",
          lines: [1, 4],
        },
      ],
    });
    const js = await sync(t, mine);
    expect(js[0]).toMatchObject({
      relation: "semantic_conflict",
      action: "block",
      direction: "other_needs_new",
    });
    const { inbox } = await rows(t);
    expect(inbox.map((i) => [i.agentId, i.action])).toEqual([[joshua, "block"]]);
  });

  test("unrelated files → nothing", async () => {
    await insert(t, {
      agentId: noah,
      files: ["docs/readme.md"],
      touches: [{ path: "docs/readme.md", op: "write", lines: [1, 3] }],
    });
    const mine = await insert(t, {
      agentId: joshua,
      files: ["db/migrations/001.sql"],
      touches: [{ path: "db/migrations/001.sql", op: "create" }],
    });
    expect(await sync(t, mine)).toEqual([]);
    expect(await rows(t)).toEqual({ classifications: [], inbox: [] });
  });

  test("an agent repeating its own failed edit after compaction → stale", async () => {
    await insert(t, {
      agentId: ash,
      verb: "EDIT",
      text: "EDIT api.cors src/server.ts → FAIL",
      outcome: "failed",
      signature: "sig-cors",
    });
    const mine = await insert(t, {
      agentId: ash,
      verb: "EDIT",
      text: "EDIT api.cors src/server.ts",
      signature: "sig-cors",
    });
    const js = await sync(t, mine);
    expect(js[0]).toMatchObject({ relation: "repeats_failure" });
    const { classifications } = await rows(t);
    expect(classifications[0]).toMatchObject({ type: "stale", agentIds: [ash] });
  });

  test("identical edit to the same lines (compatible control) is not denied", async () => {
    const edit = {
      text: "FIX api.cors web/vite.config.ts",
      topic: "api.cors",
      files: ["web/vite.config.ts"],
      touches: [{ path: "web/vite.config.ts", op: "write", lines: [4, 5] }],
      signature: "sig-proxy",
    };
    await insert(t, { agentId: noah, outcome: "succeeded", ...edit });
    const mine = await insert(t, { agentId: ash, ...edit });
    expect(await sync(t, mine)).toEqual([]);
    expect((await rows(t)).classifications).toEqual([]);
  });

  test("an open blocking conflict on a topic denies the non-owner's edits to its consumers until resolved", async () => {
    const jwt = await insert(t, {
      agentId: noah,
      text: "EDIT auth.mechanism src/auth/issue-token.ts",
      topic: "auth.mechanism",
      files: ["src/auth/issue-token.ts"],
    });
    const session = await insert(t, {
      agentId: joshua,
      text: "EDIT src/checkout/session.ts",
      files: ["src/checkout/session.ts"],
    });
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
    const routes = await insert(t, {
      agentId: joshua,
      text: "EDIT src/checkout/routes.ts",
      files: ["src/checkout/routes.ts"],
      touches: [{ path: "src/checkout/routes.ts", op: "write", lines: [10, 12] }],
    });
    const js = await sync(t, routes);
    expect(js[0]).toMatchObject({ action: "block", relation: "intent_contradiction", otherNodeId: jwt });
    expect(js[0]?.evidence[0]).toContain("auth.mechanism conflict open, owner noah decides");
    expect((await rows(t)).classifications).toHaveLength(1); // the gate points at the open row, adds none

    const ownerEdit = await insert(t, {
      agentId: noah,
      files: ["src/auth/issue-token.ts"],
      touches: [{ path: "src/auth/issue-token.ts", op: "write", lines: [20, 22] }],
    });
    expect(await sync(t, ownerEdit)).toEqual([]);

    await t.run((ctx) => ctx.db.patch(cId, { status: "resolved" }));
    const after = await insert(t, {
      agentId: joshua,
      files: ["src/checkout/routes.ts"],
      touches: [{ path: "src/checkout/routes.ts", op: "write", lines: [30, 31] }],
    });
    expect(await sync(t, after)).toEqual([]);
  });
});

describe("async path without model keys", () => {
  test("onTrajectoryEnd distills one lesson; classifyNode on a later plan falls back cleanly", async () => {
    const intent = await insert(t, {
      agentId: noah,
      kind: "intent",
      verb: "PLAN",
      text: "PLAN auth + cors",
      at: Date.now() - 10_000,
    });
    const base = Date.now() - 9_000;
    await insert(t, {
      agentId: noah,
      parentId: intent,
      text: "EDIT api.cors src/server.ts cors(origin:*, creds)",
      topic: "api.cors",
      files: ["src/server.ts"],
      outcome: "succeeded",
      signature: "sig-cors",
      at: base,
    });
    const failedTest = await insert(t, {
      agentId: noah,
      parentId: intent,
      verb: "TEST",
      text: "TEST npm test → FAIL",
      outcome: "failed",
      signature: "sig-test",
      at: base + 1,
    });
    await t.run((ctx) =>
      ctx.db.insert("events", {
        agentId: noah,
        eventKey: "k",
        source: "hook",
        hook: "PostToolUseFailure",
        files: [],
        summary: "",
        payload: {
          envelope: {
            outputTail:
              "→ browsers reject Access-Control-Allow-Origin: * when credentials are allowed: expected",
          },
        },
        nodeId: failedTest,
        at: base + 1,
      }),
    );
    await insert(t, {
      agentId: noah,
      parentId: intent,
      verb: "FIX",
      text: "FIX api.cors web/vite.config.ts proxy /api",
      topic: "api.cors",
      files: ["web/vite.config.ts"],
      outcome: "succeeded",
      at: base + 2,
    });
    await insert(t, {
      agentId: noah,
      parentId: intent,
      verb: "TEST",
      text: "TEST npm test → OK",
      outcome: "succeeded",
      at: base + 3,
    });

    await t.action(internal.classify.run.onTrajectoryEnd, { intentId: intent });
    await t.action(internal.classify.run.onTrajectoryEnd, { intentId: intent });
    const lessons = await t.run((ctx) =>
      ctx.db
        .query("nodes")
        .filter((q) => q.eq(q.field("kind"), "knowledge"))
        .collect(),
    );
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({
      verb: "LEARN",
      topic: "api.cors",
      signature: "sig-cors",
      outcome: "succeeded",
      parentId: intent,
    });
    expect(lessons[0]?.text).toBe(
      "LEARN api.cors: tried EDIT api.cors src/server.ts cors(origin:*, creds) → FAIL: browsers reject Access-Control-Allow-Origin: * when credentials are allowed → worked: FIX api.cors web/vite.config.ts proxy /api",
    );

    const plan = await insert(t, {
      agentId: ash,
      kind: "intent",
      verb: "PLAN",
      text: "PLAN add CORS middleware to the API so the storefront can call it",
    });
    await t.action(internal.classify.run.classifyNode, { nodeId: plan });
    // Lexical retrieval finds the lesson, but with no judge the verdict is a silent fallback.
    expect((await rows(t)).classifications).toEqual([]);
  });
});
