import * as nodeModule from "node:module";
import { join } from "node:path";
import { Command } from "commander";
import { lbHome } from "./config";

// Hooks spawn a fresh process per tool call; V8's compile cache makes the typescript load cheap.
try {
  nodeModule.enableCompileCache?.(join(lbHome(), "cache", "v8"));
} catch {
  // older Node: run without the cache
}

const program = new Command("lb").description("Little Brother connector").version("0.2.1");

program
  .command("join")
  .description("join a team and save a profile")
  .requiredOption("--url <siteUrl>", "backend site URL (Convex HTTP actions)")
  .option("--token <connectToken>", "one-time connect token from the website")
  .option("--invite <code>", "shared invite code (local dev only; needs --as)")
  .option("--as <handle>", "member handle (with --invite)")
  .option("--name <name>", "display name (with --invite)")
  .action(async (o: { url: string; token?: string; invite?: string; as?: string; name?: string }) => {
    const { joinCommand } = await import("./commands/join");
    await joinCommand(o);
  });

program
  .command("update")
  .description("download the latest lb from the site you joined")
  .action(async () => {
    const { updateCommand } = await import("./commands/update");
    await updateCommand();
  });

program
  .command("ask")
  .description("AskUserQuestion hook: answer on the dashboard when the session is open there")
  .action(async () => {
    const { askCommand } = await import("./commands/ask");
    await askCommand();
  });

program
  .command("hook <event>")
  .description("Claude Code hook entry: reads hook JSON on stdin (always exits 0)")
  .action(async (event: string) => {
    const { hookCommand } = await import("./commands/hook");
    await hookCommand(event);
  });

program
  .command("mcp")
  .description("stdio MCP server with channel push")
  .action(async () => {
    const { mcpCommand } = await import("./mcp/server");
    await mcpCommand();
  });

program
  .command("verify <branches...>")
  .description("merge branches in a temp worktree, run the repo's verify command, report")
  .option("--repo <dir>", "repository directory")
  .action(async (branches: string[], o: { repo?: string }) => {
    const { verifyCommand } = await import("./commands/verify");
    await verifyCommand(branches, o);
  });

program
  .command("merge-check", { hidden: true })
  .description("background merge-tree against teammates' pushed branches (spawned by the Stop hook)")
  .requiredOption("--repo <dir>", "repository root")
  .requiredOption("--session <id>", "Claude session id")
  .option("--as <handle>", "profile handle")
  .action(async (o: { repo: string; session: string; as?: string }) => {
    const { mergeCheckCommand } = await import("./verify/background");
    await mergeCheckCommand(o);
  });

program
  .command("graph-build", { hidden: true })
  .description("build the repo import graph cache (spawned by SessionStart on a cache miss)")
  .requiredOption("--repo <dir>", "repository root")
  .option("--head <sha>", "HEAD the graph is built at (default: current HEAD)")
  .option("--print", "print graph size and build time", false)
  .action(async (o: { repo: string; head?: string; print: boolean }) => {
    const { repoInfo } = await import("./hook/git");
    const { headSha } = await import("./hook/git-state");
    const info = repoInfo(o.repo);
    const head = o.head ?? headSha(info);
    if (!head) throw new Error("not a git repository with a HEAD commit");
    const { graphBuildCommand } = await import("./commands/graph-build");
    await graphBuildCommand({ repo: info.root, head, print: o.print });
  });

program
  .command("replay <file>")
  .description("replay a recorded scenario.jsonl through the hook pipeline")
  .option("--speed <n>", "speed multiplier for delays", "1")
  .option("--timeout <ms>", "per-event request timeout", "1500")
  .option("--apply", "write recorded Write/Edit content into the cwd before each PostToolUse line", false)
  .option("--parallel", "replay each agent's lines on its own timeline, concurrently", false)
  .action(async (file: string, o: { speed: string; timeout: string; apply: boolean; parallel: boolean }) => {
    const { replayCommand } = await import("./commands/replay");
    await replayCommand(file, {
      speed: Number(o.speed),
      timeout: Number(o.timeout),
      apply: o.apply,
      parallel: o.parallel,
    });
  });

program
  .command("status")
  .description("show current profile and backend reachability")
  .action(async () => {
    const { statusCommand } = await import("./commands/status");
    await statusCommand();
  });

program.parseAsync().catch((e: unknown) => {
  console.error(`lb: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
