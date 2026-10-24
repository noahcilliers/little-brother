import type { IngestEnvelope, Touch } from "@lb/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { envelope, hook, joinMember, makeT, type T } from "./platformHelpers";

const TOPICS = {
  topics: {
    "db.users": { owner: "noah", files: ["db/schema/users.ts"], consumers: ["src/checkout/**"] },
    "auth.mechanism": { owner: "noah", files: ["src/auth/**"], consumers: ["src/checkout/**"] },
    "api.cors": { owner: "noah", files: ["src/server.ts", "web/vite.config.ts"], consumers: [] },
    "api.cart.shape": { owner: "joshua", files: ["src/checkout/cart.ts"], consumers: [] },
  },
};

let clock = Date.UTC(2026, 9, 24, 9);
const tick = () => {
  clock += 1000;
  vi.setSystemTime(clock);
};

async function send(
  t: T,
  token: string,
  hookName: string,
  session: string,
  extra: Partial<IngestEnvelope> = {},
) {
  tick();
  return hook(t, token, envelope(hookName, session, extra));
}

const edit = (path: string, touches: Touch[], toolUseId: string): Partial<IngestEnvelope> => ({
  tool: "Edit",
  toolUseId,
  files: [path],
  touches: [{ path, op: "write", lines: [1, 5] }, ...touches],
  preview: `${toolUseId} change`,
});

async function editBoth(t: T, token: string, session: string, e: Partial<IngestEnvelope>) {
  await send(t, token, "PreToolUse", session, e);
  return send(t, token, "PostToolUse", session, e);
}

const tasksOf = (t: T, session: string) =>
  t.run(async (ctx) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("claudeSessionId", session))
      .first();
    if (!agent) return [];
    return ctx.db
      .query("tasks")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
  });
const nodeByToolUse = (t: T, toolUseId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("nodes")
      .withIndex("by_tool_use", (q) => q.eq("toolUseId", toolUseId))
      .first(),
  );
const bySubject = async (t: T, session: string, subject: string) =>
  (await tasksOf(t, session)).find((x) => x.subject === subject);

let t: T;
let noah: string;
let joshua: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(clock);
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  t = makeT();
  noah = await joinMember(t, "noah");
  joshua = await joinMember(t, "joshua");
  await send(t, noah, "SessionStart", "n1", { topicMap: TOPICS });
  await send(t, joshua, "SessionStart", "j1");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("task lifecycle", () => {
  test("created → in_progress when nothing else runs, pending otherwise; update and complete", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "build auth" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "1", subject: "Create users table" } });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "2", subject: "Issue JWT tokens" } });
    expect((await bySubject(t, "n1", "Create users table"))?.status).toBe("in_progress");
    expect((await bySubject(t, "n1", "Issue JWT tokens"))?.status).toBe("pending");

    // The TaskCreate call reporting the same creation (no id in its response) is not a second task.
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TaskCreate",
      task: { key: "subject:Issue JWT tokens", subject: "Issue JWT tokens" },
    });
    await send(t, noah, "TaskCompleted", "n1", {
      task: { key: "1", subject: "Create users table", status: "completed" },
    });
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TaskUpdate",
      task: { key: "2", status: "in_progress" },
    });

    const tasks = await tasksOf(t, "n1");
    expect(tasks).toHaveLength(2);
    const users = tasks.find((x) => x.taskKey === "1");
    const jwt = tasks.find((x) => x.taskKey === "2");
    expect(users).toMatchObject({ status: "completed", source: "task_tool" });
    expect(users?.endedAt).toBeGreaterThan(users?.startedAt ?? 0);
    expect(jwt?.status).toBe("in_progress");
    expect(jwt?.startedAt).toBeGreaterThan(users?.startedAt ?? 0);
    expect(jwt?.goalId).toBeDefined();
  });

  test("a TodoWrite snapshot upserts every entry, in-progress last", async () => {
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TodoWrite",
      todos: [
        { content: "Proxy /api in Vite", status: "in_progress" },
        { content: "Create users table", status: "completed" },
        { content: "Issue JWT tokens", status: "pending" },
      ],
    });
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TodoWrite",
      todos: [{ content: "Proxy /api in Vite", status: "completed" }],
    });
    const tasks = await tasksOf(t, "n1");
    expect(Object.fromEntries(tasks.map((x) => [x.subject, x.status]))).toEqual({
      "Create users table": "completed",
      "Proxy /api in Vite": "completed",
      "Issue JWT tokens": "pending",
    });
  });

  test("task-tool calls never become action nodes", async () => {
    await send(t, noah, "PostToolUse", "n1", { tool: "TaskList" });
    await send(t, noah, "PostToolUse", "n1", { tool: "TaskUpdate", task: { key: "9", status: "completed" } });
    const nodes = await t.run((ctx) => ctx.db.query("nodes").collect());
    expect(nodes.filter((n) => n.kind === "action")).toEqual([]);
  });
});

describe("attribution and labels", () => {
  test("actions go to the in-progress task, labelled verb + symbol", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "finish login" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "4", subject: "Issue JWT tokens" } });
    await editBoth(
      t,
      noah,
      "n1",
      edit(
        "src/auth/issue-token.ts",
        [{ path: "src/auth/issue-token.ts", symbol: "src/auth/issue-token.ts::issueToken", op: "write" }],
        "tu-jwt",
      ),
    );
    await send(t, noah, "PreToolUse", "n1", { tool: "Bash", toolUseId: "tu-test", command: "npm test" });
    await send(t, noah, "PostToolUse", "n1", {
      tool: "Bash",
      toolUseId: "tu-test",
      command: "npm test",
      exitCode: 0,
    });

    const task = await bySubject(t, "n1", "Issue JWT tokens");
    const jwt = await nodeByToolUse(t, "tu-jwt");
    const run = await nodeByToolUse(t, "tu-test");
    expect(jwt).toMatchObject({ taskId: task?._id, label: "edit issueToken()", outcome: "succeeded" });
    expect(run).toMatchObject({ taskId: task?._id, label: "run npm test" });
  });

  test("a pending task starts when work arrives with nothing in progress", async () => {
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TaskCreate",
      task: { key: "7", subject: "Proxy", status: "pending" },
    });
    await editBoth(t, noah, "n1", edit("web/vite.config.ts", [], "tu-proxy"));
    const task = await bySubject(t, "n1", "Proxy");
    expect(task?.status).toBe("in_progress");
    expect((await nodeByToolUse(t, "tu-proxy"))?.taskId).toBe(task?._id);
  });

  test("without a task list, actions group into inferred tasks by topic and prompt", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "build auth" });
    await editBoth(t, noah, "n1", edit("db/schema/users.ts", [], "tu-a"));
    await editBoth(t, noah, "n1", edit("db/schema/users.ts", [], "tu-b"));
    await editBoth(t, noah, "n1", { tool: "Bash", toolUseId: "tu-c", command: "npm test", exitCode: 0 });
    await editBoth(t, noah, "n1", edit("src/server.ts", [], "tu-d"));
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "now the proxy" });
    await editBoth(t, noah, "n1", edit("web/vite.config.ts", [], "tu-e"));

    const tasks = (await tasksOf(t, "n1")).sort((a, b) => a.startedAt - b.startedAt);
    expect(tasks.map((x) => [x.taskKey, x.subject, x.status, x.source])).toEqual([
      ["inferred:1", "edit db.users", "completed", "inferred"],
      ["inferred:2", "edit api.cors", "completed", "inferred"],
      ["inferred:3", "edit api.cors", "in_progress", "inferred"],
    ]);
    const ids = await Promise.all(["tu-a", "tu-b", "tu-c", "tu-d", "tu-e"].map((id) => nodeByToolUse(t, id)));
    expect(ids.map((n) => tasks.findIndex((x) => x._id === n?.taskId))).toEqual([0, 0, 0, 1, 2]);
  });
});

describe("evidenced endings", () => {
  test("a failed run then moving to another task abandons it, with the failure as note", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "storefront access" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "2", subject: "Allow storefront CORS" } });
    await editBoth(t, noah, "n1", edit("src/server.ts", [], "tu-cors"));
    await send(t, noah, "PreToolUse", "n1", { tool: "Bash", toolUseId: "tu-t1", command: "npm test" });
    await send(t, noah, "PostToolUseFailure", "n1", {
      tool: "Bash",
      toolUseId: "tu-t1",
      command: "npm test",
      exitCode: 1,
      outputTail:
        " FAIL x\nAssertionError: browsers reject Access-Control-Allow-Origin: * when credentials are allowed: expected '*'",
    });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "3", subject: "Proxy /api in Vite" } });
    await send(t, noah, "PostToolUse", "n1", {
      tool: "TaskUpdate",
      task: { key: "3", status: "in_progress" },
    });

    const cors = await bySubject(t, "n1", "Allow storefront CORS");
    expect(cors?.status).toBe("abandoned");
    expect(cors?.note).toBe(
      "run npm test failed: browsers reject Access-Control-Allow-Origin: * when credentials are allowed",
    );
    // The agent's own "completed" afterwards doesn't overwrite the evidence.
    await send(t, noah, "TaskCompleted", "n1", { task: { key: "2", status: "completed" } });
    expect((await bySubject(t, "n1", "Allow storefront CORS"))?.status).toBe("abandoned");
  });

  test("a fix landing in another task abandons the task whose run failed", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "storefront access" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "2", subject: "Allow storefront CORS" } });
    await editBoth(t, noah, "n1", { tool: "Bash", toolUseId: "tu-t2", command: "npm test", exitCode: 1 });
    await send(t, noah, "PostToolUse", "n1", { tool: "TaskUpdate", task: { key: "2", status: "pending" } });
    await send(t, noah, "TaskCreated", "n1", {
      task: { key: "3", subject: "Proxy /api in Vite", status: "in_progress" },
    });
    expect((await bySubject(t, "n1", "Allow storefront CORS"))?.status).toBe("pending");
    await editBoth(t, noah, "n1", edit("web/vite.config.ts", [], "tu-fix"));
    expect((await nodeByToolUse(t, "tu-fix"))?.verb).toBe("FIX");
    expect((await bySubject(t, "n1", "Allow storefront CORS"))?.status).toBe("abandoned");
  });

  test("a denied first action stops its task with the denial's first sentence", async () => {
    const create = (by: string): Partial<IngestEnvelope> => ({
      tool: "Write",
      toolUseId: `tu-users-${by}`,
      files: ["db/schema/users.ts"],
      touches: [{ path: "db/schema/users.ts", op: "create", lines: [1, 20] }],
      preview: `users table by ${by}`,
    });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "1", subject: "Create users table" } });
    await editBoth(t, noah, "n1", create("noah"));
    await send(t, joshua, "TaskCreated", "j1", { task: { key: "1", subject: "Create users table" } });
    const res = await send(t, joshua, "PreToolUse", "j1", create("joshua"));
    expect(JSON.stringify(res.output)).toContain("deny");

    const task = await bySubject(t, "j1", "Create users table");
    expect(task?.status).toBe("stopped");
    expect(task?.note).toBeTruthy();
    expect(task?.note).not.toContain("[little-brother]");
    expect(task?.note?.split("\n")).toHaveLength(1);
    expect((await bySubject(t, "n1", "Create users table"))?.status).toBe("in_progress");
  });

  test("approval supersedes the losing node's task and labels the decision with what the winner built", async () => {
    await send(t, joshua, "TaskCreated", "j1", { task: { key: "3", subject: "Session handling" } });
    await editBoth(t, joshua, "j1", edit("src/checkout/session.ts", [], "tu-session"));
    await send(t, joshua, "TaskCompleted", "j1", { task: { key: "3", status: "completed" } });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "4", subject: "Issue JWT tokens" } });
    await editBoth(
      t,
      noah,
      "n1",
      edit(
        "src/auth/issue-token.ts",
        [{ path: "src/auth/issue-token.ts", symbol: "src/auth/issue-token.ts::issueToken", op: "write" }],
        "tu-jwt",
      ),
    );
    const keep = await nodeByToolUse(t, "tu-jwt");
    const lose = await nodeByToolUse(t, "tu-session");
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
    const { decisionNodeId } = await t.mutation(api.resolve.approve, {
      classificationId: classificationId as Id<"classifications">,
      keepNodeId: keep._id,
    });
    const decision = await t.run((ctx) => ctx.db.get(decisionNodeId));
    expect(decision?.text).toBe("DECIDE auth.mechanism = JWT tokens");

    const session = await bySubject(t, "j1", "Session handling");
    expect(session?.status).toBe("superseded");
    expect(session?.note).toBe("Superseded: owner chose auth.mechanism = JWT tokens.");
    expect((await bySubject(t, "n1", "Issue JWT tokens"))?.status).toBe("in_progress");
  });

  test("Stop closes in-progress tasks as completed when the last test passed, with the closing note", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "finish login" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "4", subject: "Issue JWT tokens" } });
    await editBoth(t, noah, "n1", edit("src/auth/issue-token.ts", [], "tu-x"));
    await send(t, noah, "Stop", "n1", {
      preview: "Login issues a JWT. /api/me is protected.",
      stopHookActive: false,
    });
    const task = await bySubject(t, "n1", "Issue JWT tokens");
    expect(task).toMatchObject({ status: "completed", note: "Login issues a JWT." });
    expect(task?.endedAt).toBeDefined();
  });

  test("Stop after a failing test leaves the status and only sets the end", async () => {
    await send(t, noah, "UserPromptSubmit", "n1", { prompt: "cors" });
    await send(t, noah, "TaskCreated", "n1", { task: { key: "2", subject: "Allow storefront CORS" } });
    await send(t, noah, "PreToolUse", "n1", { tool: "Bash", toolUseId: "tu-f", command: "npm test" });
    await send(t, noah, "PostToolUseFailure", "n1", {
      tool: "Bash",
      toolUseId: "tu-f",
      command: "npm test",
      exitCode: 1,
    });
    await send(t, noah, "SessionEnd", "n1");
    const task = await bySubject(t, "n1", "Allow storefront CORS");
    expect(task?.status).toBe("in_progress");
    expect(task?.endedAt).toBeDefined();
  });
});
