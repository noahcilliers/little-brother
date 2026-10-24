import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHook } from "../src/hook/run";
import { readSessionId } from "../src/hook/session-file";
import * as fx from "./fixtures/hooks";
import { tempHome, tempRepo } from "./helpers";

const DEAD = "http://127.0.0.1:9";
const config = (siteUrl: string) => ({
  siteUrl,
  convexUrl: "",
  current: "noah",
  profiles: { noah: { token: "tok-noah" }, ash: { token: "tok-ash" } },
});
const outboxLines = (home: string) => {
  const p = join(home, "outbox.jsonl");
  return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean) : [];
};

let home: string;
beforeEach(() => {
  home = tempHome(config(DEAD));
  process.env.LB_HOME = home;
  delete process.env.LB_PROFILE;
  delete process.env.LB_SESSION_DIR;
  delete process.env.CLAUDE_PLUGIN_DATA;
});

describe("fail open", () => {
  it("returns no output quickly and queues the event when the backend is down", async () => {
    const t0 = Date.now();
    const r = await runHook("PreToolUse", JSON.stringify(fx.preBash));
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r).toMatchObject({ output: null, delivered: false });
    expect(outboxLines(home)).toHaveLength(1);
  });

  it("ignores garbage stdin without queuing", async () => {
    expect((await runHook("PreToolUse", "{not json")).output).toBeNull();
    expect(outboxLines(home)).toHaveLength(0);
  });

  it("the CLI exits 0 with empty stdout in under 2 s", () => {
    const cli = join(__dirname, "..", "src", "cli.ts");
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ["--import", "tsx", cli, "hook", "PreToolUse"], {
      input: JSON.stringify(fx.preBash),
      env: { ...process.env, LB_HOME: home },
      cwd: join(__dirname, ".."),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(outboxLines(home)).toHaveLength(1);
  });
});

describe("delivery", () => {
  let server: Server;
  const seen: { url?: string; auth?: string; body: unknown }[] = [];
  afterEach(() => server?.close());

  async function start(): Promise<string> {
    seen.length = 0;
    server = createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(data) });
        const deny = {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "owned by noah",
          },
        };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ output: req.url === "/hook/PreToolUse" ? deny : null }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("posts the envelope with the profile token, returns output, and flushes the outbox", async () => {
    await runHook("UserPromptSubmit", fx.userPrompt, { as: "ash" });
    expect(outboxLines(home)).toHaveLength(1);
    writeFileSync(join(home, "config.json"), JSON.stringify(config(await start())));
    const r = await runHook("PreToolUse", fx.preBash);
    expect(r.output).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" } });
    expect(seen[0]).toMatchObject({
      url: "/hook/PreToolUse",
      auth: "Bearer tok-noah",
      body: { v: 1, hook: "PreToolUse" },
    });
    expect(seen[1]).toMatchObject({ url: "/hook/UserPromptSubmit", auth: "Bearer tok-ash" });
    expect(outboxLines(home)).toHaveLength(0);
  });

  it("SessionStart writes the session id for lb mcp, keyed by project dir", async () => {
    const repo = tempRepo();
    process.env.LB_SESSION_DIR = join(home, "sessions");
    await runHook(
      "SessionStart",
      { session_id: "abc", cwd: repo, hook_event_name: "SessionStart" },
      { cwd: repo },
    );
    expect(readSessionId(repo)).toBe("abc");
    expect(readSessionId("/elsewhere")).toBe("");
  });
});
