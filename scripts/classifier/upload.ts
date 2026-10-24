import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localDeployment } from "./export-deployment";

// Stores a trained model in `settings` through the validating mutation (classify/pairModel:upload).
// --local targets the local backend; without it, whatever packages/backend is configured for. Never point
// this at production without reviewing the model's metrics first.
//
//   npx tsx scripts/classifier/upload.ts <model.json> --local

const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/backend");

const [file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!file) throw new Error("usage: upload.ts <model.json> [--local]");
const model: unknown = JSON.parse(readFileSync(resolve(file), "utf8"));
const env = process.argv.includes("--local")
  ? { ...process.env, CONVEX_DEPLOYMENT: localDeployment() }
  : process.env;
const out = execFileSync("npx", ["convex", "run", "classify/pairModel:upload", JSON.stringify({ model })], {
  cwd: BACKEND,
  env,
  maxBuffer: 64 * 1024 * 1024,
});
console.log(out.toString().trim());
