import { writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replayCommand } from "../src/commands/replay";
import { tempHome } from "./helpers";

type Hit = { url?: string; auth?: string; body: Record<string, unknown> };

describe("replayCommand", () => {
  let server: Server;
  afterEach(() => server?.close());

  it("replays the demo scenario: hooks per profile, MCP via /mcp/{tool}, step ids printed", async () => {
    const hits: Hit[] = [];
    server = createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        hits.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(data) });
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify(req.url?.startsWith("/mcp/") ? { text: "decision recorded" } : { output: null }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const siteUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const profiles = Object.fromEntries(
      ["noah", "joshua", "ash", "maya", "leo", "priya"].map((h) => [h, { token: `tok-${h}` }]),
    );
    process.env.LB_HOME = tempHome({ siteUrl, convexUrl: "", current: "ash", profiles });
    process.env.LB_SESSION_DIR = join(process.env.LB_HOME, "sessions");

    const out: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((s: string) => void out.push(s));
    await replayCommand(join(__dirname, "../../../fixtures/scenario.jsonl"), {
      speed: 1e6,
      timeout: 1500,
      apply: false,
    });
    log.mockRestore();

    expect(out).toHaveLength(185);
    expect(out.find((l) => l.startsWith("14-joshua-users.pre"))).toContain("[joshua]");
    expect(out.find((l) => l.startsWith("23-noah-decision"))).toContain(
      "MCP post_decision → decision recorded",
    );
    const mcp = hits.find((h) => h.url === "/mcp/post_decision");
    expect(mcp).toMatchObject({
      auth: "Bearer tok-noah",
      body: { claudeSessionId: "7b3e2c1a-4f5d-4e8a-9c21-0d6f8a1b2c3d" },
    });
    expect(hits.filter((h) => h.url?.startsWith("/hook/"))).toHaveLength(184);
    // Stop lines carry their transcript snapshot, so the replayed Stop prices each tool call.
    const stop = hits.find((h) => h.url === "/hook/Stop" && h.auth === "Bearer tok-noah");
    const priced = Object.keys((stop?.body.toolTokens ?? {}) as Record<string, number>);
    expect(priced.length).toBeGreaterThan(5);
    expect(stop?.body.turnTokens).toBeGreaterThan(0);
    expect(hits.find((h) => h.auth === "Bearer tok-joshua")?.body).toMatchObject({
      session: { cwd: "/tmp/lb-demo/joshua" },
    });
    // 185 lines through the real hook pipeline (TS normalization included): slow on a busy machine.
  }, 30_000);

  it("--parallel runs each agent on its own timeline: a slow agent delays only itself", async () => {
    server = createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        const slow = req.headers.authorization === "Bearer tok-noah";
        setTimeout(
          () => {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ output: null }));
          },
          slow ? 300 : 0,
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const siteUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const profiles = Object.fromEntries(["noah", "joshua"].map((h) => [h, { token: `tok-${h}` }]));
    process.env.LB_HOME = tempHome({ siteUrl, convexUrl: "", current: "noah", profiles });
    process.env.LB_SESSION_DIR = join(process.env.LB_HOME, "sessions");
    const line = (step: string, as: string, delayMs: number) =>
      JSON.stringify({
        step,
        as,
        delayMs,
        input: { hook_event_name: "TaskCreated", session_id: `s-${as}`, cwd: "/tmp", task_id: step },
      });
    const file = join(process.env.LB_HOME, "parallel.jsonl");
    writeFileSync(
      file,
      [line("a-noah", "noah", 0), line("b-joshua", "joshua", 50), line("c-noah", "noah", 0)].join("\n"),
    );

    const out: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((s: string) => void out.push(s));
    await replayCommand(file, { speed: 1, timeout: 1500, apply: false, parallel: true });
    log.mockRestore();
    // Sequential replay would print a, b, c; in parallel joshua's line doesn't wait for noah's slow backend.
    expect(out.map((l) => l.split(" ")[0])).toEqual(["b-joshua", "a-noah", "c-noah"]);
  });
});
