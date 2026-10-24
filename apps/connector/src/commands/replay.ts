import { readFileSync } from "node:fs";
import { runHook } from "../hook/run";
import { readSessionId } from "../hook/session-file";
import { callTool } from "../mcp/tools";
import { applyRecordedEdit } from "./replay-apply";
import { describeOutput, parseReplay, type ReplayLine } from "./replay-parse";

export type ReplayOptions = { speed: number; timeout: number; apply: boolean; parallel?: boolean };

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

/**
 * `--parallel`: every agent replays on its own timeline at once, as in real use. Each line is due at its
 * recorded time (the running sum of delays); an agent's lines still run one after another, so a slow response
 * delays only that agent. Cross-agent order holds only through those times, never by waiting on another agent.
 */
async function replayParallel(lines: ReplayLine[], opts: ReplayOptions, speed: number): Promise<void> {
  const sessions = new Map<string, string>();
  const queues = new Map<string, { line: ReplayLine; step: string; dueMs: number }[]>();
  let offset = 0;
  for (const [i, line] of lines.entries()) {
    offset += line.delayMs ?? 0;
    const queue = queues.get(line.as) ?? [];
    queue.push({ line, step: line.step ?? String(i + 1), dueMs: offset / speed });
    queues.set(line.as, queue);
  }
  const start = Date.now();
  await Promise.all(
    [...queues.values()].map(async (queue) => {
      for (const { line, step, dueMs } of queue) {
        const wait = start + dueMs - Date.now();
        if (wait > 0) await sleep(wait);
        console.log(`${step.padEnd(28)} [${line.as}] ${await replayLine(line, opts, sessions)}`);
      }
    }),
  );
}

export async function replayCommand(file: string, opts: ReplayOptions): Promise<void> {
  const { lines, errors } = parseReplay(readFileSync(file, "utf8"));
  for (const e of errors) console.error(`line ${e.line}: ${e.message}`);
  const speed = opts.speed > 0 ? opts.speed : 1;
  if (opts.parallel) return replayParallel(lines, opts, speed);
  const sessions = new Map<string, string>();
  for (const [i, line] of lines.entries()) {
    if (line.delayMs) await sleep(line.delayMs / speed);
    const step = line.step ?? String(i + 1);
    console.log(`${step.padEnd(28)} [${line.as}] ${await replayLine(line, opts, sessions)}`);
  }
}
