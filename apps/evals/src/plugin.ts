import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const Hooks = z.object({ description: z.string().optional(), hooks: z.record(z.array(z.unknown())) });

/** The connector command the real plugin runs, which resolves `lb` from ~/.local/bin first. */
const INSTALLED_LB = 'PATH="$HOME/.local/bin:$PATH" lb';

/**
 * A copy of plugin/ wired to this checkout's connector build instead of the installed `lb`, so an eval
 * measures the code under test.
 *
 * `claude -p` exits as soon as its task is done, and SessionEnd marks the agent offline, which takes its
 * work out of every later comparison. An interactive session stays open after its task, so the copy drops
 * SessionEnd and the harness closes all agents together when the case ends.
 */
export function buildEvalPlugin(pluginSrc: string, outDir: string, cliPath: string): string {
  const dir = join(outDir, "plugin");
  rmSync(dir, { recursive: true, force: true });
  cpSync(pluginSrc, dir, { recursive: true });
  rmSync(join(dir, ".mcp.json"), { force: true });
  const hooksFile = join(dir, "hooks", "hooks.json");
  const parsed = Hooks.parse(JSON.parse(readFileSync(hooksFile, "utf8")));
  const { SessionEnd: _held, ...kept } = parsed.hooks;
  const local = `node ${JSON.stringify(cliPath)}`;
  const rewritten = JSON.stringify({ ...parsed, hooks: kept }, null, 2).replaceAll(
    JSON.stringify(INSTALLED_LB).slice(1, -1),
    JSON.stringify(local).slice(1, -1),
  );
  if (rewritten.includes("$HOME/.local/bin"))
    throw new Error("plugin hooks changed shape; update apps/evals/src/plugin.ts");
  writeFileSync(hooksFile, rewritten);
  return dir;
}

/** MCP config for `--strict-mcp-config`: only the lb server, so the user's own MCP servers stay out. */
export function writeMcpConfig(outDir: string, cliPath: string): string {
  const file = join(outDir, "mcp.json");
  writeFileSync(
    file,
    JSON.stringify({ mcpServers: { lb: { command: "node", args: [cliPath, "mcp"] } } }, null, 2),
  );
  return file;
}
