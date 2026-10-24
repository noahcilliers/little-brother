import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAttachment } from "../src/hook/attach";
import { runHook } from "../src/hook/run";
import * as fx from "./fixtures/hooks";
import { tempHome } from "./helpers";

type Hit = { path: string; body: { code?: string; session?: { lbSession?: string } } };

let server: Server;
let hits: Hit[];

/** A fake backend: one known session code, hooks answered with no output. */
async function backend(): Promise<string> {
  hits = [];
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c: Buffer) => {
      raw += c.toString();
    });
    req.on("end", () => {
      const body = JSON.parse(raw || "{}") as Hit["body"];
      hits.push({ path: req.url ?? "", body });
      if (req.url === "/session/attach") {
        const ok = body.code === "k7f2qx";
        res.writeHead(ok ? 200 : 404, { "content-type": "application/json" });
        res.end(JSON.stringify(ok ? { code: "k7f2qx", name: "auth sprint", room: "cal" } : { error: "no" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ output: null }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const prompt = (text: string) => JSON.stringify({ ...fx.userPrompt, prompt: text });
const contextOf = (out: unknown) =>
  (out as { hookSpecificOutput?: { additionalContext?: string } } | null)?.hookSpecificOutput
    ?.additionalContext ?? "";

beforeEach(async () => {
  const siteUrl = await backend();
  process.env.LB_HOME = tempHome({
    siteUrl,
    convexUrl: "",
    current: "ash",
    profiles: { ash: { token: "t" } },
  });
  process.env.LB_SESSION_DIR = `${process.env.LB_HOME}/sessions`;
  delete process.env.LB_SESSION;
});
afterEach(() => server.close());

describe("opt-in sessions", () => {
  it("a Claude session that never joined sends nothing", async () => {
    const r = await runHook("UserPromptSubmit", prompt("refactor the cart"));
    expect(r.output).toBeNull();
    expect(hits).toEqual([]);
  });

  it("join attaches, registers the session, and later hooks carry the code; leave stops them", async () => {
    const joined = await runHook("UserPromptSubmit", prompt("/little-brother:join K7F2QX"));
    expect(contextOf(joined.output)).toMatch(/joined "auth sprint" in room cal/);
    expect(readAttachment(fx.userPrompt.session_id)?.code).toBe("k7f2qx");
    expect(hits.map((h) => h.path)).toEqual(["/session/attach", "/hook/SessionStart"]);

    await runHook("UserPromptSubmit", prompt("refactor the cart"));
    expect(hits.at(-1)?.body.session?.lbSession).toBe("k7f2qx");

    const left = await runHook("UserPromptSubmit", prompt("lb:leave"));
    expect(contextOf(left.output)).toMatch(/left "auth sprint"/);
    expect(hits.at(-1)?.path).toBe("/hook/SessionEnd");
    const before = hits.length;
    await runHook("UserPromptSubmit", prompt("more work"));
    expect(hits).toHaveLength(before);
  });

  it("an unknown code joins nothing and says so", async () => {
    const r = await runHook("UserPromptSubmit", prompt("/little-brother:join nope99"));
    expect(contextOf(r.output)).toMatch(/No open session with code nope99/);
    expect(readAttachment(fx.userPrompt.session_id)).toBeNull();
  });
});
