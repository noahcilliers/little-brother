import { isAbsolute, relative } from "node:path";
import { z } from "zod";

// Claude Code's `--output-format stream-json` lines, reduced to what triggers and checks need.

const ToolUse = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});
const ToolResult = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  is_error: z.boolean().optional(),
  content: z.unknown().optional(),
});
const Block = z.union([ToolUse, ToolResult, z.object({ type: z.string() }).passthrough()]);
const Line = z.union([
  z
    .object({ type: z.literal("system"), subtype: z.string(), session_id: z.string().optional() })
    .passthrough(),
  z.object({
    type: z.enum(["assistant", "user"]),
    message: z.object({ content: z.array(Block).or(z.string()) }),
  }),
  z
    .object({
      type: z.literal("result"),
      total_cost_usd: z.number().optional(),
      num_turns: z.number().optional(),
      is_error: z.boolean().optional(),
      result: z.string().optional(),
    })
    .passthrough(),
]);

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const DENY_MARK = "[little-brother]";

type Pending = { name: string; file?: string; command?: string };

export type AgentLog = {
  sessionId?: string;
  pending: Map<string, Pending>;
  /** Files the agent tried to edit, relative to its worktree, even when the edit was denied. */
  touched: Set<string>;
  commands: string[];
  firstEditAt: number | null;
  /** Little Brother deny or warn texts the agent saw in tool results. */
  lbMessages: string[];
  costUsd: number;
  turns: number;
  finished: boolean;
  resultText: string;
};

export const emptyLog = (): AgentLog => ({
  pending: new Map(),
  touched: new Set(),
  commands: [],
  firstEditAt: null,
  lbMessages: [],
  costUsd: 0,
  turns: 0,
  finished: false,
  resultText: "",
});

const text = (v: unknown): string =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? v.map((x) => (x && typeof x === "object" && "text" in x ? String(x.text) : "")).join("\n")
      : "";

function field(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object" || !(key in input)) return undefined;
  const v = (input as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

const rel = (root: string, file: string): string => (isAbsolute(file) ? relative(root, file) : file);

/** Files a shell command writes with `>`, `>>` or `tee`; agents sometimes create files with heredocs. */
export function redirectTargets(command: string): string[] {
  // Only the command line itself: a heredoc body is file content (`=>` and all), not shell.
  const line = command.split("\n")[0] ?? "";
  const out: string[] = [];
  for (const m of line.matchAll(/(?:^|[^0-9&>=])>>?\s*(['"]?)([^\s'"|;&<>]+)\1/g)) if (m[2]) out.push(m[2]);
  for (const m of line.matchAll(/\btee\s+(?:-a\s+)?(['"]?)([^\s'"|;&<>]+)\1/g)) if (m[2]) out.push(m[2]);
  return out.filter((f) => f !== "/dev/null" && !f.startsWith("&"));
}

/** Folds one stdout line into the log. Returns true when this line was the agent's first successful edit. */
export function applyLine(log: AgentLog, raw: string, root: string, now: number): boolean {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return false;
  }
  const parsed = Line.safeParse(json);
  if (!parsed.success) return false;
  const line = parsed.data;
  if (line.type === "system") {
    if (line.subtype === "init" && line.session_id) log.sessionId = line.session_id;
    return false;
  }
  if (line.type === "result") {
    log.finished = true;
    log.costUsd = line.total_cost_usd ?? log.costUsd;
    log.turns = line.num_turns ?? log.turns;
    log.resultText = line.result ?? "";
    return false;
  }
  if (typeof line.message.content === "string") return false;
  let firstEdit = false;
  for (const block of line.message.content) {
    const use = ToolUse.safeParse(block);
    if (use.success) {
      const file = field(use.data.input, "file_path") ?? field(use.data.input, "notebook_path");
      const command = field(use.data.input, "command");
      log.pending.set(use.data.id, {
        name: use.data.name,
        ...(file ? { file: rel(root, file) } : {}),
        ...(command ? { command } : {}),
      });
      if (file && EDIT_TOOLS.has(use.data.name)) log.touched.add(rel(root, file));
      if (command && use.data.name === "Bash") {
        log.commands.push(command);
        for (const f of redirectTargets(command)) log.touched.add(rel(root, f));
      }
      continue;
    }
    const res = ToolResult.safeParse(block);
    if (!res.success) continue;
    const body = text(res.data.content);
    if (body.includes(DENY_MARK)) log.lbMessages.push(body.slice(0, 600));
    const call = log.pending.get(res.data.tool_use_id);
    if (call && EDIT_TOOLS.has(call.name) && !res.data.is_error && log.firstEditAt === null) {
      log.firstEditAt = now;
      firstEdit = true;
    }
  }
  return firstEdit;
}
