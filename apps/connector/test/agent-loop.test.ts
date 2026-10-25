import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentEvent,
  blockStop,
  type ChatModel,
  type ChatRequest,
  type ChatTurn,
  context,
  deny,
  type ToolCall,
} from "@lb/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hookBridge } from "../src/agent/hooks";
import { runAgent } from "../src/agent/loop";
import { tempHome } from "./helpers";

type Hit = { hook: string; tool?: string; files?: string[]; turnTokens?: number; stopHookActive?: boolean };

let server: Server;
let hits: Hit[];
let stops = 0;

/** A fake backend: denies any Edit of users.ts, adds context after a Write, blocks the first Stop. */
async function backend(): Promise<string> {
  hits = [];
  stops = 0;
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c: Buffer) => {
      raw += c.toString();
    });
    req.on("end", () => {
      const body = JSON.parse(raw || "{}") as Record<string, unknown> & { files?: string[] };
      const hook = (req.url ?? "").replace("/hook/", "");
      hits.push({
        hook,
        ...(typeof body.tool === "string" ? { tool: body.tool } : {}),
        ...(body.files ? { files: body.files } : {}),
        ...(typeof body.turnTokens === "number" ? { turnTokens: body.turnTokens } : {}),
        ...(typeof body.stopHookActive === "boolean" ? { stopHookActive: body.stopHookActive } : {}),
      });
      let output: unknown = null;
      if (hook === "SessionStart")
        output = context("SessionStart", "[little-brother] noah is on the users table");
      if (hook === "PreToolUse" && body.tool === "Edit" && body.files?.includes("users.ts"))
        output = deny("[little-brother] duplicate · noah already added a users table; import it");
      if (hook === "PostToolUse" && body.tool === "Write") output = context("PostToolUse", "teammate note");
      if (hook === "Stop" && stops++ === 0) output = blockStop("run the tests first");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ output }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Plays a fixed script of turns and records every request it got. */
function scripted(
  turns: { text?: string; calls?: Omit<ToolCall, "id">[] }[],
): ChatModel & { seen: ChatRequest[] } {
  const seen: ChatRequest[] = [];
  let i = 0;
  return {
    provider: "fake",
    model: "fake-1",
    seen,
    async complete(req): Promise<ChatTurn> {
      seen.push(structuredClone(req));
      const t = turns[Math.min(i, turns.length - 1)] ?? {};
      i++;
      return {
        id: `msg_${i}`,
        text: t.text ?? "",
        toolCalls: (t.calls ?? []).map((c, n) => ({ ...c, id: `call_${i}_${n}` })),
        usage: { input: 100, output: 10, cached: 0 },
      };
    },
  };
}

function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "lb-agent-")));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  writeFileSync(join(dir, "users.ts"), "export const users = [];\n");
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "init", "--allow-empty"],
    { cwd: dir },
  );
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "files"], { cwd: dir });
  return dir;
}

async function run(model: ChatModel, cwd: string, enabled = true) {
  const events: AgentEvent[] = [];
  const transcriptPath = join(cwd, ".transcript.jsonl");
  const final = await runAgent({
    model,
    sessionId: "agent-s1",
    cwd,
    prompt: "add an email column to users",
    system: "sys",
    hooks: hookBridge({ enabled, sessionId: "agent-s1", cwd, transcriptPath }),
    hooksEnabled: enabled,
    emit: (e) => events.push(e),
    transcript: (e) => writeFileSync(transcriptPath, `${JSON.stringify(e)}\n`, { flag: "a" }),
    maxTurns: 10,
    price: { input: 1, output: 1, cached: 0 },
  });
  return { final, events };
}

beforeEach(async () => {
  const siteUrl = await backend();
  process.env.LB_HOME = tempHome({
    siteUrl,
    convexUrl: "",
    current: "ash",
    profiles: { ash: { token: "t" } },
  });
  process.env.LB_SESSION_DIR = `${process.env.LB_HOME}/sessions`;
  process.env.LB_SESSION = "k7f2qx";
});
afterEach(() => {
  server.close();
  delete process.env.LB_SESSION;
});

const EDIT = {
  name: "Edit",
  args: { file_path: "users.ts", old_string: "[]", new_string: "[{ email: '' }]" },
};

describe("lb agent loop", () => {
  it("runs every call through the hooks: a denied edit never runs and its reason reaches the model", async () => {
    const cwd = repo();
    const model = scripted([
      { calls: [{ name: "Read", args: { file_path: "users.ts" } }] },
      { calls: [EDIT] },
      { calls: [{ name: "Write", args: { file_path: "email.ts", content: "export const email = '';\n" } }] },
      { text: "Done." },
      { text: "Tests pass." },
    ]);
    const { final, events } = await run(model, cwd);

    expect(final).toMatchObject({
      reason: "done",
      turns: 5,
      text: "Tests pass.",
      tokens: { input: 500, output: 50 },
    });
    expect(readFileSync(join(cwd, "users.ts"), "utf8")).toBe("export const users = [];\n");
    expect(existsSync(join(cwd, "email.ts"))).toBe(true);

    const toolText = (n: number) => model.seen[n]?.messages.at(-1);
    expect(model.seen[0]?.messages[0]).toMatchObject({
      role: "user",
      text: expect.stringMatching(/noah is on the users table[\s\S]*add an email column/),
    });
    expect(toolText(2)).toMatchObject({
      role: "tool",
      text: expect.stringMatching(/^Blocked by Little Brother: \[little-brother\] duplicate/),
    });
    expect(toolText(3)).toMatchObject({
      text: expect.stringMatching(/Created email.ts[\s\S]*teammate note/),
    });
    expect(toolText(4)).toEqual({ role: "user", text: "run the tests first" });

    expect(hits.map((h) => `${h.hook}${h.tool ? `:${h.tool}` : ""}`)).toEqual([
      "SessionStart",
      "UserPromptSubmit",
      "PostToolUse:Read",
      "PreToolUse:Edit",
      "PreToolUse:Write",
      "PostToolUse:Write",
      "Stop",
      "Stop",
      "SessionEnd",
    ]);
    expect(hits.find((h) => h.hook === "PreToolUse")?.files).toEqual(["users.ts"]);
    expect(hits.filter((h) => h.hook === "Stop").map((h) => h.stopHookActive)).toEqual([false, true]);
    // Usage reaches the backend from the transcript the agent wrote, as it does from Claude Code's.
    expect(hits.find((h) => h.hook === "Stop")?.turnTokens).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === "lb_deny")).toHaveLength(1);
    expect(events.filter((e) => e.type === "lb_stop_block")).toHaveLength(1);
  });

  it("answers malformed arguments and unknown tools with an error the model can fix, without hooks", async () => {
    const cwd = repo();
    const model = scripted([
      {
        calls: [
          { name: "Bash", args: '{"command": ' },
          { name: "Deploy", args: {} },
        ],
      },
      { text: "Gave up." },
    ]);
    await run(model, cwd);
    const results = model.seen[1]?.messages
      .filter((m) => m.role === "tool")
      .map((m) => (m.role === "tool" ? m.text : ""));
    expect(results?.[0]).toMatch(/not valid JSON/);
    expect(results?.[1]).toMatch(/Unknown tool "Deploy"/);
    expect(hits.some((h) => h.hook === "PreToolUse")).toBe(false);
  });

  it("with hooks off, sends nothing and the edit goes through", async () => {
    const cwd = repo();
    const { final } = await run(scripted([{ calls: [EDIT] }, { text: "Done." }]), cwd, false);
    expect(final.reason).toBe("done");
    expect(hits).toEqual([]);
    expect(readFileSync(join(cwd, "users.ts"), "utf8")).toContain("email");
  });

  it("refuses paths outside the working directory", async () => {
    const cwd = repo();
    const model = scripted([
      { calls: [{ name: "Read", args: { file_path: "../../etc/passwd" } }] },
      { text: "ok" },
    ]);
    await run(model, cwd, false);
    expect(model.seen[1]?.messages.at(-1)).toMatchObject({
      text: expect.stringMatching(/outside the working directory/),
    });
  });
});
