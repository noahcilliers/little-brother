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
    const profiles = Object.fromEntries(["noah", "joshua", "ash"].map((h) => [h, { token: `tok-${h}` }]));
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

    expect(out).toHaveLength(43);
    expect(out.find((l) => l.startsWith("14-joshua-users.pre"))).toContain("[joshua]");
    expect(out.find((l) => l.startsWith("23-noah-decision"))).toContain(
      "MCP post_decision → decision recorded",
    );
    const mcp = hits.find((h) => h.url === "/mcp/post_decision");
    expect(mcp).toMatchObject({
      auth: "Bearer tok-noah",
      body: { claudeSessionId: "7b3e2c1a-4f5d-4e8a-9c21-0d6f8a1b2c3d" },
    });
    expect(hits.filter((h) => h.url?.startsWith("/hook/"))).toHaveLength(42);
    expect(hits.find((h) => h.auth === "Bearer tok-joshua")?.body).toMatchObject({
      session: { cwd: "/tmp/lb-demo/joshua" },
    });
  });
});
