import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./datasets/common";

// Pages through `classify/exportPairs:page` on a deployment and writes one JSONL. Runs `npx convex run` in
// packages/backend, so it targets whatever deployment that directory is configured for; pass --local to use
// the local backend `npx convex dev` runs (packages/backend/.convex/local), as the evals do.
//
//   npx tsx scripts/classifier/export-deployment.ts --local --out ~/.cache/little-brother/datasets/pairs/local.jsonl

const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/backend");

type Page = { lines: string[]; continueCursor: string; isDone: boolean };

/** The local backend's name, e.g. "anonymous:anonymous-agent", from the config `npx convex dev` wrote. */
export function localDeployment(): string {
  const config = JSON.parse(readFileSync(resolve(BACKEND, ".convex/local/default/config.json"), "utf8")) as {
    deploymentName?: string;
  };
  if (!config.deploymentName)
    throw new Error("no local Convex deployment: run `npx convex dev` in packages/backend");
  return `anonymous:${config.deploymentName}`;
}

function main(): void {
  const argv = process.argv.slice(2);
  const out = resolve(flag(argv, "out", "pairs.jsonl"));
  const pageSize = Number(flag(argv, "page", "200"));
  const env = argv.includes("--local")
    ? { ...process.env, CONVEX_DEPLOYMENT: localDeployment() }
    : process.env;
  const lines: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const args = JSON.stringify({ paginationOpts: { numItems: pageSize, cursor } });
    const raw = execFileSync("npx", ["convex", "run", "classify/exportPairs:page", args], {
      cwd: BACKEND,
      env,
      maxBuffer: 512 * 1024 * 1024,
    });
    const page = JSON.parse(raw.toString()) as Page;
    lines.push(...page.lines);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.length ? `${lines.join("\n")}\n` : "");
  console.log(`${lines.length} labelled pairs → ${out}`);
}

if (process.argv[1]?.endsWith("export-deployment.ts")) main();
