import type { IngestEnvelope } from "@lb/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { joinMember, makeT, type T } from "./platformHelpers";
import { bySubject, CLOCK_START, edit, editBoth, nodeByToolUse, send, TOPICS } from "./taskHelpers";

let t: T;
let noah: string;
let joshua: string;
let ash: string;

const classifications = (t: T) => t.run((ctx) => ctx.db.query("classifications").collect());
const create = (by: string): Partial<IngestEnvelope> => ({
  tool: "Write",
  toolUseId: `tu-users-${by}`,
  files: ["db/schema/users.ts"],
  touches: [{ path: "db/schema/users.ts", op: "create", lines: [1, 20] }],
  preview: `users table by ${by}`,
});
const cors = (toolUseId: string): Partial<IngestEnvelope> => ({
  tool: "Edit",
  toolUseId,
  files: ["src/server.ts"],
  touches: [{ path: "src/server.ts", op: "write", lines: [3, 4] }],
  preview: 'app.use(cors({ origin: "*", credentials: true }));',
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(CLOCK_START);
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  t = makeT();
  noah = await joinMember(t, "noah");
  joshua = await joinMember(t, "joshua");
  ash = await joinMember(t, "ash");
  await send(t, noah, "SessionStart", "n1", { topicMap: TOPICS });
  await send(t, joshua, "SessionStart", "j1");
  await send(t, ash, "SessionStart", "a1");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("tool tokens", () => {
  test("Stop prices each tool call and rolls up per task and goal, idempotently", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "build auth" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "1", subject: "Create users table" } });
    await editBoth(t, noah, "n1", edit("db/schema/users.ts", [], "tu-1"));
    await editBoth(t, noah, "n1", edit("db/schema/users.ts", [], "tu-2"));
    await send(t, noah, "PostToolUse", "n1", { tool: "Read", toolUseId: "tu-3", files: ["README.md"] });
    const toolTokens = { "tu-1": 100, "tu-2": 50, "tu-3": 10, "tu-unknown": 5 };
    await send(t, noah, "Stop", "n1", { toolTokens, turnTokens: 900 });
    await send(t, noah, "Stop", "n1", { toolTokens, turnTokens: 900 });

    expect((await nodeByToolUse(t, "tu-1"))?.tokens).toBe(100);
    expect((await nodeByToolUse(t, "tu-3"))?.tokens).toBe(10);
    expect((await bySubject(t, "n1", "Create users table"))?.tokens).toBe(160);
    const intent = await t.run(async (ctx) =>
      (await ctx.db.query("nodes").collect()).find((n) => n.kind === "intent"),
    );
    expect(intent?.tokens).toBe(160);
  });

  test("another agent's tool_use ids are never priced", async () => {
    await editBoth(t, noah, "n1", edit("src/auth/a.ts", [], "tu-n"));
    await send(t, joshua, "PreCompact", "j1", { toolTokens: { "tu-n": 999 } });
    expect((await nodeByToolUse(t, "tu-n"))?.tokens).toBeUndefined();
  });
});

describe("tokens saved per catch (estimates)", () => {
  test("duplicate: the owner's original task, filled in once the owner's tokens arrive", async () => {
    await send(t, noah, "TaskCreated", "n1", { task: { key: "1", subject: "Create users table" } });
    await editBoth(t, noah, "n1", create("noah"));
    await send(t, joshua, "PreToolUse", "j1", create("joshua"));
    const [dup] = await classifications(t);
    expect(dup).toMatchObject({ type: "duplicate" });
    expect(dup?.tokensSaved).toBeUndefined();

    await send(t, noah, "Stop", "n1", { toolTokens: { "tu-users-noah": 4200 } });
    expect((await classifications(t))[0]?.tokensSaved).toBe(4200);
  });

  test("stale: the failed trajectory behind the lesson (its abandoned task)", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "storefront access" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "2", subject: "Allow storefront CORS" } });
    await editBoth(t, noah, "n1", cors("tu-cors"));
    await editBoth(t, noah, "n1", { tool: "Bash", toolUseId: "tu-test", command: "npm test", exitCode: 1 });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "3", subject: "Proxy /api in Vite" } });
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TaskUpdate",
      task: { key: "3", status: "in_progress" },
    });
    await send(t, noah, "Stop", "n1", { toolTokens: { "tu-cors": 3000, "tu-test": 800 } });
    const tried = await nodeByToolUse(t, "tu-cors");
    if (!tried?.parentId) throw new Error("no attempt");
    await t.mutation(internal.classify.lessons.insertLesson, {
      intentId: tried.parentId,
      text: "LEARN api.cors: tried wildcard cors → FAIL",
      files: ["src/server.ts"],
      outcome: "failed",
      signature: tried.signature,
    });

    const res = await send(t, ash, "PreToolUse", "a1", cors("tu-ash"));
    expect(JSON.stringify(res.output)).toContain("deny");
    const stale = (await classifications(t)).find((c) => c.relation === "repeats_failure");
    expect(stale?.tokensSaved).toBe(3800);
  });

  test("conflict: the superseded task's tokens once the owner decides", async () => {
    await send(t, joshua, "TaskCreated", "j1", { task: { key: "3", subject: "Session handling" } });
    await editBoth(t, joshua, "j1", edit("src/checkout/session.ts", [], "tu-session"));
    await send(t, noah, "TaskCreated", "n1", { task: { key: "4", subject: "Issue JWT tokens" } });
    await editBoth(t, noah, "n1", edit("src/auth/issue-token.ts", [], "tu-jwt"));
    const [keep, lose] = await Promise.all([nodeByToolUse(t, "tu-jwt"), nodeByToolUse(t, "tu-session")]);
    if (!keep || !lose) throw new Error("nodes missing");
    const classificationId = await t.run((ctx) =>
      ctx.db.insert("classifications", {
        nodeId: keep._id,
        againstNodeId: lose._id,
        type: "conflict",
        relation: "intent_contradiction",
        direction: "none",
        action: "block",
        agentIds: [keep.agentId, lose.agentId],
        reason: "jwt vs cookie",
        evidence: [],
        confidence: 0.9,
        retrievalScore: 1,
        source: "llm",
        status: "open",
        latencyMs: 1,
        at: Date.now(),
      }),
    );
    await send(t, joshua, "Stop", "j1", { toolTokens: { "tu-session": 2500 } });
    expect((await classifications(t))[0]?.tokensSaved).toBeUndefined(); // open: nothing spared yet

    await t.mutation(api.resolve.approve, {
      classificationId: classificationId as Id<"classifications">,
      keepNodeId: keep._id,
    });
    expect((await classifications(t))[0]?.tokensSaved).toBe(2500);
  });
});
