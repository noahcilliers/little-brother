import { readFileSync } from "node:fs";
import { runHook } from "../hook/run";
import { readSessionId } from "../hook/session-file";
import { callTool } from "../mcp/tools";
import { applyRecordedEdit } from "./replay-apply";
import { describeOutput, parseReplay, type ReplayLine } from "./replay-parse";

export type ReplayOptions = { speed: number; timeout: number; apply: boolean };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function label(input: Record<string, unknown>): string {
  const tool = typeof input.tool_name === "string" ? ` ${input.tool_name}` : "";
  const ti = (input.tool_input ?? {}) as Record<string, unknown>;
  const target = [ti.file_path, ti.command, input.prompt].find((v) => typeof v === "string");
  const t = typeof target === "string" ? ` ${target.split("\n")[0]?.slice(0, 60)}` : "";
  return `${String(input.hook_event_name)}${tool}${t}`;
}

/** Hook lines run the real hook pipeline; MCP lines take the same POST path `lb mcp` uses. */
async function replayLine(
  line: ReplayLine,
  opts: ReplayOptions,
  sessions: Map<string, string>,
): Promise<string> {
  if ("mcp" in line) {
    const claudeSessionId = sessions.get(line.as) ?? readSessionId(line.cwd);
    try {
      const text = await callTool(line.mcp, line.args, { as: line.as, claudeSessionId });
      return `MCP ${line.mcp} → ${text.split("\n")[0]?.slice(0, 140) ?? ""}`;
    } catch (e) {
      return `MCP ${line.mcp} → failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const { input } = line;
  if (typeof input.session_id === "string") sessions.set(line.as, input.session_id);
  const cwd = line.cwd ?? (typeof input.cwd === "string" ? input.cwd : process.cwd());
  if (opts.apply) {
    try {
      applyRecordedEdit(input, cwd);
    } catch (e) {
      process.stderr.write(`apply failed: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }
  const r = await runHook(input.hook_event_name, input, {
    as: line.as,
    cwd: line.cwd,
    timeoutMs: opts.timeout,
  });
  const why = r.error && !r.delivered ? ` — ${r.error}` : "";
  return `${label(input)} → ${describeOutput(r.output, r.delivered)}${why}`;
}

export async function replayCommand(file: string, opts: ReplayOptions): Promise<void> {
  const { lines, errors } = parseReplay(readFileSync(file, "utf8"));
  for (const e of errors) console.error(`line ${e.line}: ${e.message}`);
  const speed = opts.speed > 0 ? opts.speed : 1;
  const sessions = new Map<string, string>();
  for (const [i, line] of lines.entries()) {
    if (line.delayMs) await sleep(line.delayMs / speed);
    const step = line.step ?? String(i + 1);
    console.log(`${step.padEnd(28)} [${line.as}] ${await replayLine(line, opts, sessions)}`);
  }
}
