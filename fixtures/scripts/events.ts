import { createHash } from "node:crypto";
import { shop } from "./snippets";

export type Handle = "noah" | "joshua" | "ash";

/** One line of scenario.jsonl: a hook payload, or an MCP tool call made by that agent's session. */
export type ScenarioLine = { step: string; delayMs: number; as: Handle; cwd: string } & (
  | { input: Record<string, unknown> }
  | { mcp: string; args: Record<string, unknown> }
);

const SESSIONS: Record<Handle, string> = {
  noah: "7b3e2c1a-4f5d-4e8a-9c21-0d6f8a1b2c3d",
  joshua: "9f1c2a64-8d0e-4b7f-a315-6e2c9b4d7f10",
  ash: "c4d8e2f0-1a6b-4c3d-8e9f-5b7a2d0c6e81",
};

export const cwdOf = (as: Handle) => `/tmp/lb-demo/${as}`;

const common = (as: Handle, hook_event_name: string) => ({
  session_id: SESSIONS[as],
  transcript_path: `/Users/${as}/.claude/projects/-tmp-lb-demo-${as}/${SESSIONS[as]}.jsonl`,
  cwd: cwdOf(as),
  hook_event_name,
});

const toolUseId = (step: string) =>
  `toolu_01${createHash("sha256")
    .update(step)
    .digest("base64")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 22)}`;

/** Per-agent worktree contents, so every Edit's old_string is checked against what that agent really has. */
const worktrees = new Map<Handle, Map<string, string>>();
function readFile(as: Handle, rel: string): string {
  const tree = worktrees.get(as) ?? new Map<string, string>();
  worktrees.set(as, tree);
  return tree.get(rel) ?? shop(rel);
}
function writeFile(as: Handle, rel: string, content: string): void {
  const tree = worktrees.get(as) ?? new Map<string, string>();
  worktrees.set(as, tree);
  tree.set(rel, content);
}

export class Story {
  readonly lines: ScenarioLine[] = [];
  private readonly taskIds = new Map<Handle, number>();

  private push(step: string, delayMs: number, as: Handle, input: Record<string, unknown>) {
    this.lines.push({ step, delayMs, as, cwd: cwdOf(as), input });
  }

  sessionStart(step: string, delayMs: number, as: Handle) {
    this.push(step, delayMs, as, { ...common(as, "SessionStart"), source: "startup" });
  }

  prompt(step: string, delayMs: number, as: Handle, prompt: string) {
    this.push(step, delayMs, as, { ...common(as, "UserPromptSubmit"), permission_mode: "default", prompt });
  }

  private tool(
    step: string,
    delayMs: number,
    as: Handle,
    tool_name: string,
    tool_input: Record<string, unknown>,
  ) {
    const base = { ...common(as, "PreToolUse"), permission_mode: "default", tool_name, tool_input };
    this.push(`${step}.pre`, delayMs, as, { ...base, tool_use_id: toolUseId(step) });
    return (post: Record<string, unknown>, hook = "PostToolUse") =>
      this.push(`${step}.post`, 400, as, {
        ...base,
        hook_event_name: hook,
        ...post,
        tool_use_id: toolUseId(step),
      });
  }

  /** `denied` writes stop at PreToolUse: Claude Code never runs the tool, so there is no PostToolUse. */
  write(step: string, delayMs: number, as: Handle, rel: string, content: string, denied = false) {
    const file_path = `${cwdOf(as)}/${rel}`;
    const post = this.tool(step, delayMs, as, "Write", { file_path, content });
    if (denied) return;
    writeFile(as, rel, content);
    post({ tool_response: { type: "create", filePath: file_path, content, structuredPatch: [] } });
  }

  edit(
    step: string,
    delayMs: number,
    as: Handle,
    rel: string,
    old_string: string,
    new_string: string,
    denied = false,
  ) {
    const before = readFile(as, rel);
    if (before.split(old_string).length !== 2)
      throw new Error(`${step}: old_string not unique in ${as}:${rel}`);
    const file_path = `${cwdOf(as)}/${rel}`;
    const post = this.tool(step, delayMs, as, "Edit", {
      file_path,
      old_string,
      new_string,
      replace_all: false,
    });
    if (denied) return;
    writeFile(as, rel, before.replace(old_string, new_string));
    post({
      tool_response: {
        filePath: file_path,
        oldString: old_string,
        newString: new_string,
        replaceAll: false,
        userModified: false,
        structuredPatch: [],
      },
    });
  }

  bash(
    step: string,
    delayMs: number,
    as: Handle,
    command: string,
    description: string,
    output: string,
    ok: boolean,
  ) {
    const post = this.tool(step, delayMs, as, "Bash", { command, description });
    if (ok) post({ tool_response: { stdout: output, stderr: "", interrupted: false, isImage: false } });
    else post({ error: `Exit code 1\n${output}`, is_interrupt: false }, "PostToolUseFailure");
  }

  stop(step: string, delayMs: number, as: Handle, last_assistant_message: string) {
    this.push(step, delayMs, as, {
      ...common(as, "Stop"),
      permission_mode: "default",
      stop_hook_active: false,
      last_assistant_message,
    });
  }

  sessionEnd(step: string, delayMs: number, as: Handle) {
    this.push(step, delayMs, as, { ...common(as, "SessionEnd"), reason: "prompt_input_exit" });
  }

  /** Reads only reach PostToolUse: the plugin's PreToolUse matcher covers writes and commands. */
  read(step: string, delayMs: number, as: Handle, rel: string) {
    const file_path = `${cwdOf(as)}/${rel}`;
    const content = readFile(as, rel);
    this.push(step, delayMs, as, {
      ...common(as, "PostToolUse"),
      permission_mode: "default",
      tool_name: "Read",
      tool_input: { file_path },
      tool_response: {
        type: "text",
        file: { filePath: file_path, content, numLines: content.split("\n").length },
      },
      tool_use_id: toolUseId(step),
    });
  }

  /**
   * One step of the agent's task list: TaskCreated (fired by its TaskCreate call), then the TaskUpdate call that
   * marks it in progress. Returns the completion, which fires TaskCompleted. Task ids count up per session.
   */
  task(step: string, delayMs: number, as: Handle, subject: string, description: string) {
    const ids = (this.taskIds.get(as) ?? 0) + 1;
    this.taskIds.set(as, ids);
    const task_id = String(ids);
    this.push(`${step}.created`, delayMs, as, {
      ...common(as, "TaskCreated"),
      task_id,
      task_subject: subject,
      task_description: description,
    });
    this.push(`${step}.start`, 100, as, {
      ...common(as, "PostToolUse"),
      permission_mode: "default",
      tool_name: "TaskUpdate",
      tool_input: { taskId: task_id, status: "in_progress" },
      tool_response: { success: true, taskId: task_id, updatedFields: ["status"] },
      tool_use_id: toolUseId(`${step}.start`),
    });
    return (doneStep: string, doneDelayMs: number) =>
      this.push(doneStep, doneDelayMs, as, {
        ...common(as, "TaskCompleted"),
        task_id,
        task_subject: subject,
        task_description: description,
      });
  }

  mcp(step: string, delayMs: number, as: Handle, tool: string, args: Record<string, unknown>) {
    this.lines.push({ step, delayMs, as, cwd: cwdOf(as), mcp: tool, args });
  }
}
