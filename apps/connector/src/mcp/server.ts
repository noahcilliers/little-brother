import { McpArgs } from "@lb/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { activeProfile } from "../config";
import { startChannel } from "./channel";
import { callTool, TOOL_DESCRIPTIONS, type ToolName } from "./tools";

const INSTRUCTIONS = [
  "Little Brother coordinates you with teammates' Claude Code sessions working on the same repo.",
  'Messages arriving as <channel source="lb" ...> are little-brother inbox items: act on them, then call ack with their item_id.',
  "Use post_decision / post_knowledge / report_failure so other agents do not repeat your work or your mistakes.",
].join("\n");

export async function mcpCommand(): Promise<void> {
  const server = new McpServer(
    { name: "little-brother", version: "0.1.0" },
    { capabilities: { experimental: { "claude/channel": {} }, tools: {} }, instructions: INSTRUCTIONS },
  );

  for (const name of Object.keys(McpArgs) as ToolName[]) {
    server.registerTool(
      name,
      { description: TOOL_DESCRIPTIONS[name], inputSchema: McpArgs[name] },
      async (args: unknown) => {
        try {
          return { content: [{ type: "text" as const, text: await callTool(name, args) }] };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            content: [{ type: "text" as const, text: `little-brother unavailable: ${msg}` }],
            isError: true,
          };
        }
      },
    );
  }

  // stdout belongs to JSON-RPC; any stray console.log from a dependency must go to stderr.
  console.log = (...args: unknown[]) => console.error(...args);
  let stopChannel: (() => void) | null = null;
  const transport = new StdioServerTransport();
  const shutdown = (): void => {
    stopChannel?.();
    process.exit(0);
  };
  transport.onclose = shutdown;
  process.stdin.on("end", shutdown);
  await server.connect(transport);

  const profile = activeProfile();
  if (!profile?.convexUrl) return;
  try {
    stopChannel = await startChannel(profile, (p) =>
      // claude/channel is a research-preview notification the SDK's typed union does not list yet.
      server.server.notification({
        method: "notifications/claude/channel",
        params: p,
      } as unknown as ServerNotification),
    );
  } catch (e) {
    process.stderr.write(`lb mcp: channel push disabled (${e instanceof Error ? e.message : String(e)})\n`);
  }
}
