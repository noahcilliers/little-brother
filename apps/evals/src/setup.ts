import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { type Backend, describeBackend, healthy } from "./backend";
import { Budget } from "./budget";
import { shOrThrow } from "./exec";
import type { Options } from "./options";
import { buildEvalPlugin, writeMcpConfig } from "./plugin";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONNECTOR = join(ROOT, "apps/connector");

/**
 * A private copy of the connector build for this invocation. Other people rebuild `apps/connector/dist`
 * while evals run (tsup cleans it first), which would swap the code under test mid-run or delete it.
 */
function snapshotConnector(outDir: string): string {
  const dir = join(outDir, "connector");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(CONNECTOR, "dist"), join(dir, "dist"), { recursive: true });
  symlinkSync(join(CONNECTOR, "node_modules"), join(dir, "node_modules"), "dir");
  return join(dir, "dist", "cli.js");
}

const Profiles = z.object({ siteUrl: z.string().optional(), profiles: z.record(z.unknown()).optional() });

function joinedProfiles(lbHome: string, site: string): Set<string> {
  const file = join(lbHome, "config.json");
  if (!existsSync(file)) return new Set();
  const parsed = Profiles.safeParse(JSON.parse(readFileSync(file, "utf8")));
  return parsed.success && parsed.data.siteUrl === site
    ? new Set(Object.keys(parsed.data.profiles ?? {}))
    : new Set();
}

/**
 * Joining a handle replaces its token on the backend, which logs out every other LB_HOME holding that
 * handle: two eval invocations joining "noah" separately would turn each other's hooks into 401s. So all
 * invocations share one LB_HOME and only join handles it doesn't have yet.
 */
function joinAgents(cli: string, lbHome: string, site: string, handles: string[]): void {
  const env = { ...process.env, LB_HOME: lbHome };
  const invite = process.env.LB_INVITE_CODE ?? "calhacks";
  const have = joinedProfiles(lbHome, site);
  for (const h of handles)
    if (!have.has(h))
      shOrThrow("node", [cli, "join", "--url", site, "--invite", invite, "--as", h], ROOT, env);
}

export type Harness = {
  backend: Backend;
  backendInfo: string;
  outDir: string;
  workDir: string;
  tag: string;
  cliPath: string;
  lbHome: string;
  pluginDir: string;
  mcpConfig: string;
  budget: Budget;
  startedAt: Date;
};

/** Everything a live eval needs before its first run: a healthy local backend, a connector, joined handles. */
export async function prepareHarness(opts: Options, handles: string[]): Promise<Harness> {
  const backend: Backend = { dir: join(ROOT, "packages/backend"), siteUrl: opts.site };
  if (!(await healthy(backend)))
    throw new Error(
      `no backend at ${opts.site}: run \`npx convex dev\` in packages/backend (CONVEX_AGENT_MODE=anonymous)`,
    );
  const backendInfo = describeBackend(backend);
  if (!backendInfo.includes("open mode on"))
    throw new Error(
      "backend is not in open mode: `npx convex env set LB_ALLOW_INVITE 1` in packages/backend",
    );
  if (opts.build) shOrThrow("npm", ["run", "build", "--silent"], CONNECTOR);
  if (!existsSync(join(CONNECTOR, "dist/cli.js"))) throw new Error("connector not built");
  const startedAt = new Date();
  const tag = startedAt.toISOString().replace(/[-:]/g, "").slice(4, 15).replace("T", "");
  const outDir = resolve(
    opts.out ?? join(ROOT, "apps/evals/results", startedAt.toISOString().replace(/[:.]/g, "-")),
  );
  const workDir = join(realpathSync("/tmp"), "lb-evals", tag);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  const cliPath = snapshotConnector(outDir);
  const lbHome = resolve(process.env.LB_EVAL_HOME ?? join(ROOT, "apps/evals/results/.lb-home"));
  joinAgents(cliPath, lbHome, opts.site, [...new Set(handles)]);
  return {
    backend,
    backendInfo,
    outDir,
    workDir,
    tag,
    cliPath,
    lbHome,
    pluginDir: buildEvalPlugin(join(ROOT, "plugin"), outDir, cliPath),
    mcpConfig: writeMcpConfig(outDir, cliPath),
    budget: new Budget(opts.capUsd, resolve(opts.ledger ?? join(ROOT, "apps/evals/results/ledger.jsonl"))),
    startedAt,
  };
}
