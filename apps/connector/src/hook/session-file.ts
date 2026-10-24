import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lbHome } from "../config";
import { sha1 } from "../hash";

export function sessionDir(): string {
  if (process.env.LB_SESSION_DIR) return process.env.LB_SESSION_DIR;
  if (process.env.CLAUDE_PLUGIN_DATA) return join(process.env.CLAUDE_PLUGIN_DATA, "sessions");
  return join(lbHome(), "sessions");
}

export function projectKey(projectDir?: string): string {
  return sha1(projectDir ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
}

/** MCP servers never learn the Claude session id, so SessionStart leaves it here for `lb mcp`. */
export function writeSessionId(sessionId: string, projectDir?: string): void {
  try {
    mkdirSync(sessionDir(), { recursive: true });
    writeFileSync(
      join(sessionDir(), `${projectKey(projectDir)}.json`),
      JSON.stringify({ session_id: sessionId }),
    );
  } catch {
    // best effort: lb mcp falls back to member+repo on the backend
  }
}

export function readSessionId(projectDir?: string): string {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(join(sessionDir(), `${projectKey(projectDir)}.json`), "utf8"),
    );
    const id =
      typeof raw === "object" && raw !== null ? (raw as { session_id?: unknown }).session_id : undefined;
    return typeof id === "string" ? id : "";
  } catch {
    return "";
  }
}
