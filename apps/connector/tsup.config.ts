import { defineConfig } from "tsup";

// @lb/core ships TypeScript source, so it must be bundled; everything else stays external
// so heavy deps (typescript, MCP SDK, convex) load lazily only on the commands that need them.
export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  dts: false,
  noExternal: ["@lb/core"],
  banner: { js: "#!/usr/bin/env node" },
});
