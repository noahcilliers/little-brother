import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { joinCommand, joinRequest } from "../src/commands/join";
import { loadConfig } from "../src/config";
import { tempHome } from "./helpers";

describe("joinRequest", () => {
  it("sends only the connect token when one is given", () => {
    expect(joinRequest({ url: "x", token: "ct_1", invite: "calhacks", as: "ash" }).body).toEqual({
      token: "ct_1",
    });
  });

  it("falls back to invite + handle for local dev", () => {
    expect(joinRequest({ url: "x", invite: "calhacks", as: "ash" }).body).toEqual({
      invite: "calhacks",
      handle: "ash",
      name: "ash",
    });
  });

  it("rejects an invite without a handle", () => {
    expect(() => joinRequest({ url: "x", invite: "calhacks" })).toThrow(/--token/);
  });
});

describe("joinCommand", () => {
  let server: Server;
  afterEach(() => server?.close());

  it("exchanges a connect token and saves the profile under the returned handle", async () => {
    const bodies: unknown[] = [];
    server = createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        bodies.push(JSON.parse(data));
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            token: "lb_secret",
            convexUrl: "https://x.convex.cloud",
            siteUrl: "https://x.convex.site/",
            handle: "noah",
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    process.env.LB_HOME = tempHome();

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await joinCommand({ url, token: "ct_abc" });
    log.mockRestore();

    expect(bodies).toEqual([{ token: "ct_abc" }]);
    const cfg = loadConfig();
    expect(cfg.current).toBe("noah");
    expect(cfg.siteUrl).toBe("https://x.convex.site");
    expect(cfg.convexUrl).toBe("https://x.convex.cloud");
    expect(cfg.profiles.noah).toEqual({ token: "lb_secret" });
  });
});
