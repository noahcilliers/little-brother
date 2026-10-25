import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Little Brother for OpenCode: copy to .opencode/plugins/ (or ~/.config/opencode/plugins/). Tool calls are
// rewritten into Claude Code's hook shapes and piped through `lb hook`, so the classifier sees the same
// events a Claude Code session sends. A deny throws, which is how OpenCode blocks a tool call.
//
// Verified against opencode.ai/docs/plugins: the plugin export shape, `tool.execute.before(input, output)`
// with `input.tool` and `output.args`, blocking by throwing, and the `session.created` / `session.idle`
// events. Not documented there, so read defensively: `tool.execute.after`'s fields (`input.callID`,
// `input.sessionID`, `output.output`) and the event payload fields.

type Ctx = { directory: string; worktree?: string };
type ToolInput = { tool: string; sessionID?: string; callID?: string };
type Args = { args: Record<string, unknown> };
type After = { output?: unknown; metadata?: unknown };

const NAMES: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Bash",
  glob: "Glob",
  grep: "Grep",
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** OpenCode's camelCase args as Claude Code's snake_case tool_input. */
function claudeInput(tool: string, a: Record<string, unknown>): Record<string, unknown> {
  if (tool === "Bash") return { command: str(a.command) ?? "" };
  if (tool === "Glob" || tool === "Grep") return { pattern: str(a.pattern) ?? "", path: str(a.path) };
  const out: Record<string, unknown> = { file_path: str(a.filePath) ?? str(a.file_path) ?? "" };
  if (tool === "Write") out.content = str(a.content) ?? "";
  if (tool === "Edit") {
    out.old_string = str(a.oldString) ?? "";
    out.new_string = str(a.newString) ?? "";
    out.replace_all = a.replaceAll === true;
  }
  return out;
}

/** `lb hook` always exits 0; anything unparseable reads as "no output" (fail open). */
function hook(event: string, input: Record<string, unknown>): unknown {
  try {
    const r = spawnSync("lb", ["hook", event], {
      input: JSON.stringify(input),
      encoding: "utf8",
      timeout: 3000,
    });
    return r.stdout ? JSON.parse(r.stdout) : null;
  } catch {
    return null;
  }
}

function denyReason(out: unknown): string | undefined {
  const h = (out as { hookSpecificOutput?: Record<string, unknown> } | null)?.hookSpecificOutput;
  return h?.permissionDecision === "deny" ? String(h.permissionDecisionReason ?? "denied") : undefined;
}

export const LittleBrother = async ({ directory, worktree }: Ctx) => {
  const cwd = worktree ?? directory;
  // OpenCode's own session id when the hook input carries one; otherwise one per plugin instance.
  const fallbackId = randomUUID();
  const base = (sessionID?: string) => ({ session_id: sessionID ?? fallbackId, cwd });
  const ids = new Map<string, string>();
  const callId = (i: ToolInput, args: unknown): string => {
    const key = i.callID ?? JSON.stringify(args);
    const id = ids.get(key) ?? i.callID ?? randomUUID();
    ids.set(key, id);
    return id;
  };
  return {
    "tool.execute.before": async (input: ToolInput, output: Args) => {
      const tool = NAMES[input.tool];
      if (!tool || tool === "Read" || tool === "Glob" || tool === "Grep") return;
      const out = hook("PreToolUse", {
        ...base(input.sessionID),
        hook_event_name: "PreToolUse",
        tool_name: tool,
        tool_input: claudeInput(tool, output.args),
        tool_use_id: callId(input, output.args),
      });
      const reason = denyReason(out);
      if (reason) throw new Error(`Blocked by Little Brother: ${reason}`);
    },
    "tool.execute.after": async (input: ToolInput & Partial<Args>, output: After) => {
      const tool = NAMES[input.tool];
      if (!tool) return;
      const args = input.args ?? {};
      hook("PostToolUse", {
        ...base(input.sessionID),
        hook_event_name: "PostToolUse",
        tool_name: tool,
        tool_input: claudeInput(tool, args),
        tool_response: tool === "Bash" ? { stdout: str(output.output) ?? "", stderr: "" } : output.metadata,
        tool_use_id: callId(input, args),
      });
    },
    event: async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }) => {
      const sessionID =
        str(event.properties?.sessionID) ?? str((event.properties?.info as { id?: unknown })?.id);
      if (event.type === "session.created")
        hook("SessionStart", { ...base(sessionID), hook_event_name: "SessionStart", source: "startup" });
      if (event.type === "session.idle") hook("Stop", { ...base(sessionID), hook_event_name: "Stop" });
    },
  };
};
