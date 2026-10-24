import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests drive the legacy invite path and the dashboard unauthenticated: local open mode.
  test: {
    environment: "edge-runtime",
    env: { LB_ALLOW_INVITE: "1" },
    server: { deps: { inline: ["convex-test"] } },
  },
});
