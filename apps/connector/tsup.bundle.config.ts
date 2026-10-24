import { defineConfig } from "tsup";

// The distributable: one dependency-free file that runs with plain `node lb.mjs` on a laptop
// that has never seen this repo. Everything is inlined, and splitting is off so the lazy
// `import()`s of typescript, the MCP SDK and convex become in-file closures instead of chunks.
// Bundled CJS (typescript) expects `require`, `__filename` and `__dirname`, which ESM lacks,
// hence the banner.
export default defineConfig({
  entry: { lb: "src/cli.ts" },
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  target: "node20",
  platform: "node",
  clean: false,
  dts: false,
  splitting: false,
  minify: true,
  noExternal: [/.*/],
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __lbCreateRequire } from "node:module";',
      'import { fileURLToPath as __lbFileURLToPath } from "node:url";',
      'import { dirname as __lbDirname } from "node:path";',
      "const require = __lbCreateRequire(import.meta.url);",
      "const __filename = __lbFileURLToPath(import.meta.url);",
      "const __dirname = __lbDirname(__filename);",
    ].join("\n"),
  },
});
