import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { runSyncChecks } from "../convex/classify/sync";
import { makeT, type T } from "./platformHelpers";

type NodeIn = Partial<Omit<Doc<"nodes">, "_id" | "_creationTime">> & { agentId: Id<"agents"> };

const TOPICS = {
  topics: {
    "db.users": { owner: "noah", files: ["db/schema/users.ts"], consumers: ["src/checkout/**"] },
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
      repo: "shop",
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

const usersCreate = (agentId: Id<"agents">, lines: [number, number]): NodeIn => ({
  agentId,
  text: "EDIT db.users db/schema/users.ts",
  topic: "db.users",
  files: ["db/schema/users.ts"],
  touches: [
    { path: "db/schema/users.ts", op: "create", lines },
    { path: "db/schema/users.ts", symbol: "db/schema/users.ts::findUserByEmail", op: "create" },
  ],
});

const sync = (t: T, id: Id<"nodes">) => t.run((ctx) => runSyncChecks(ctx, id).then((r) => r.judgments));
const rows = (t: T) =>
  t.run(async (ctx) => ({
    classifications: await ctx.db.query("classifications").collect(),
    inbox: await ctx.db.query("inbox").collect(),
  }));
const denies = (js: { action: string }[]) =>
  js.filter((j) => j.action === "serialize" || j.action === "block");

let t: T;
let noah: Id<"agents">;
let joshua: Id<"agents">;
let ash: Id<"agents">;

beforeEach(async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  t = makeT();
  noah = await agent(t, "noah");
  joshua = await agent(t, "joshua");
  ash = await agent(t, "ash");
  await t.run((ctx) => ctx.db.insert("settings", { key: "topics:shop", value: TOPICS }));
});
afterEach(() => vi.unstubAllEnvs());

describe("collisions settled by claim strength", () => {
  test("the owner arriving second takes over; the other agent is told to stop and later edits are denied", async () => {
    const first = await insert(t, usersCreate(joshua, [1, 20]));
    const mine = await insert(t, usersCreate(noah, [1, 30]));
    expect(denies(await sync(t, mine))).toEqual([]);

    const { classifications, inbox } = await rows(t);
    expect(classifications).toHaveLength(1);
    expect(classifications[0]).toMatchObject({
      nodeId: mine,
      againstNodeId: first,
      relation: "textual_conflict",
      type: "duplicate",
      action: "warn",
      winnerAgentId: noah,
    });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ agentId: joshua, action: "serialize" });
    expect(inbox[0]?.text).toContain("noah owns db.users and is taking over db/schema/users.ts");
    expect(inbox[0]?.text).toContain("use findUserByEmail from db/schema/users.ts");

    // Re-classifying either side keeps the settled claim: no new rows, no repeated alerts.
    await sync(t, mine);
    await sync(t, first);
    expect((await rows(t)).classifications).toHaveLength(1);
    expect((await rows(t)).inbox).toHaveLength(1);

    // Joshua's next edit to the taken-over file is denied even though no pairwise rule fires (disjoint lines).
    const later = await insert(t, {
      agentId: joshua,
      text: "EDIT db.users db/schema/users.ts",
      files: ["db/schema/users.ts"],
      touches: [{ path: "db/schema/users.ts", op: "write", lines: [100, 110] }],
    });
    const js = denies(await sync(t, later));
    expect(js[0]).toMatchObject({ action: "serialize", otherNodeId: mine, winner: "other" });
    expect(js[0]?.evidence.join(" ")).toContain("noah owns db.users");

    // The winner keeps working on it.
    const own = await insert(t, {
      agentId: noah,
      files: ["db/schema/users.ts"],
      touches: [{ path: "db/schema/users.ts", op: "write", lines: [200, 210] }],
    });
    expect(denies(await sync(t, own))).toEqual([]);
  });

  test("a non-owner arriving second is denied with the owner named", async () => {
    await insert(t, usersCreate(noah, [1, 30]));
    const mine = await insert(t, usersCreate(joshua, [1, 20]));
    const js = denies(await sync(t, mine));
    expect(js[0]).toMatchObject({ action: "serialize", winner: "other" });
    const { classifications, inbox } = await rows(t);
    expect(classifications[0]).toMatchObject({ action: "serialize", winnerAgentId: noah });
    expect(classifications[0]?.reason).toContain("noah owns db.users");
    expect(inbox).toEqual([]);
  });

  test("equal claims: the first one holds", async () => {
    const lib = (agentId: Id<"agents">): NodeIn => ({
      agentId,
      files: ["lib/util.ts"],
      touches: [{ path: "lib/util.ts", op: "write", lines: [1, 10] }],
    });
    const first = await insert(t, lib(ash));
    const mine = await insert(t, lib(joshua));
    const js = denies(await sync(t, mine));
    expect(js[0]).toMatchObject({ relation: "textual_conflict", action: "serialize", otherNodeId: first });
    const { classifications } = await rows(t);
    expect(classifications[0]).toMatchObject({ winnerAgentId: ash });
    expect(classifications[0]?.reason).toContain("ash claimed it first");
  });

  test("more verified progress on the current task takes over", async () => {
    const intent = await insert(t, {
      agentId: joshua,
      kind: "intent",
      verb: "PLAN",
      text: "PLAN util",
      at: 1,
    });
    await t.run((ctx) => ctx.db.patch(joshua, { intentId: intent }));
    for (const verb of ["EDIT", "TEST"]) {
      await insert(t, { agentId: joshua, parentId: intent, verb, outcome: "succeeded", at: 2 });
    }
    const lib = (agentId: Id<"agents">): NodeIn => ({
      agentId,
      files: ["lib/util.ts"],
      touches: [{ path: "lib/util.ts", op: "write", lines: [1, 10] }],
    });
    await insert(t, lib(ash));
    const mine = await insert(t, lib(joshua));
    expect(denies(await sync(t, mine))).toEqual([]);
    const { classifications, inbox } = await rows(t);
    expect(classifications[0]).toMatchObject({ winnerAgentId: joshua });
    expect(inbox[0]).toMatchObject({ agentId: ash, action: "serialize" });
  });

  test("pushed work no longer blocks; committed work still does", async () => {
    const theirs = await insert(t, { ...usersCreate(noah, [1, 30]), landed: "pushed" });
    expect(denies(await sync(t, await insert(t, usersCreate(joshua, [1, 20]))))).toEqual([]);
    await t.run((ctx) => ctx.db.patch(theirs, { landed: "committed" }));
    expect(denies(await sync(t, await insert(t, usersCreate(joshua, [1, 20]))))).toHaveLength(1);
  });

  test("different base commits only warn on overlapping lines", async () => {
    const edit = (agentId: Id<"agents">, baseRev: string): NodeIn => ({
      agentId,
      baseRev,
      files: ["lib/util.ts"],
      touches: [{ path: "lib/util.ts", op: "write", lines: [1, 10] }],
    });
    await insert(t, edit(ash, "aaa"));
    const js = await sync(t, await insert(t, edit(joshua, "bbb")));
    expect(js[0]).toMatchObject({ relation: "textual_conflict", action: "warn", confidence: 0.6 });
  });
});

describe("claims won by progress hold lines, not the file", () => {
  test("the other agent may edit elsewhere in the file, but not the claimed lines", async () => {
    const t = makeT();
    const priya = await agent(t, "priya");
    const leo = await agent(t, "leo");
    const edit = (agentId: Id<"agents">, lines: [number, number]): NodeIn => ({
      agentId,
      text: "EDIT src/jinja2/ext.py",
      files: ["src/jinja2/ext.py"],
      touches: [{ path: "src/jinja2/ext.py", op: "write", lines }],
    });
    const held = await insert(t, edit(priya, [260, 294]));
    const first = await insert(t, edit(leo, [269, 300]));
    await t.run((ctx) =>
      ctx.db.insert("classifications", {
        nodeId: first,
        againstNodeId: held,
        type: "conflict",
        relation: "textual_conflict",
        direction: "none",
        action: "serialize",
        winnerAgentId: priya,
        agentIds: [leo, priya],
        reason: "both edit src/jinja2/ext.py",
        evidence: [
          "R1: both edit src/jinja2/ext.py lines 269-300 vs 260-294",
          "claim: is further along (8 verified steps)",
        ],
        confidence: 0.9,
        retrievalScore: 1,
        source: "rule",
        status: "open",
        latencyMs: 1,
        at: Date.now(),
      }),
    );
    const sync = (id: Id<"nodes">) => t.run((ctx) => runSyncChecks(ctx, id));
    const elsewhere = await sync(await insert(t, edit(leo, [400, 420])));
    expect(elsewhere.judgments.filter((j) => j.action === "serialize")).toEqual([]);
    const inside = await sync(await insert(t, edit(leo, [270, 275])));
    expect(inside.judgments[0]).toMatchObject({ action: "serialize", winner: "other" });
  });
});
