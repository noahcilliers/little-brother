import request from "supertest";
import type { UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import viteConfig from "../../web/vite.config";
import { app } from "../../src/server";

const STOREFRONT_ORIGIN = "http://localhost:5173";

describe("storefront can reach the API from the browser", () => {
  it("via the Vite /api proxy or a credential-safe CORS policy", async () => {
    const proxy = (viteConfig as UserConfig).server?.proxy?.["/api"];
    if (proxy) return; // same origin in the browser: no CORS involved

    const res = await request(app)
      .options("/api/products")
      .set("Origin", STOREFRONT_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,authorization");
    const allowOrigin = res.headers["access-control-allow-origin"];
    expect(allowOrigin, "no /api proxy in web/vite.config.ts and no CORS headers on the API").toBeDefined();
    if (res.headers["access-control-allow-credentials"] === "true") {
      expect(allowOrigin, "browsers reject Access-Control-Allow-Origin: * when credentials are allowed").not.toBe(
        "*",
      );
    }
  });
});
