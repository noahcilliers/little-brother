#!/usr/bin/env node
// Puts the connector where the website serves it: apps/web/public/{lb.mjs,install.sh}.
// Runs before `next build` (see apps/web/vercel.json); both outputs are gitignored build artifacts.
//
// install.sh needs to know the site it was served from. It is baked in here, at build time:
//   LB_PUBLIC_ORIGIN                 explicit, e.g. https://lb.example.com (set this for a custom domain)
//   VERCEL_PROJECT_PRODUCTION_URL    Vercel production builds (custom domain if one is set)
//   VERCEL_URL                       Vercel preview builds
//   http://localhost:3000            local `next dev`
// The installer still honours LB_ORIGIN at run time, so a wrong bake-in is never a dead end.
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "apps/connector/dist/lb.mjs");
const publicDir = join(root, "apps/web/public");

function origin() {
  const env = process.env;
  if (env.LB_PUBLIC_ORIGIN) return env.LB_PUBLIC_ORIGIN;
  const host =
    env.VERCEL_ENV === "production" ? (env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL) : env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

if (!process.argv.includes("--no-build")) {
  const r = spawnSync("pnpm", ["--filter", "@lb/connector", "bundle"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const site = origin().replace(/\/+$/, "");
mkdirSync(publicDir, { recursive: true });
copyFileSync(bundle, join(publicDir, "lb.mjs"));
const installer = readFileSync(join(root, "scripts/install.template.sh"), "utf8").replaceAll(
  "__LB_ORIGIN__",
  site,
);
writeFileSync(join(publicDir, "install.sh"), installer);
chmodSync(join(publicDir, "install.sh"), 0o755);

const mb = (statSync(bundle).size / 1024 / 1024).toFixed(1);
console.log(`publish-connector: lb.mjs (${mb} MB) + install.sh for ${site} → apps/web/public`);
