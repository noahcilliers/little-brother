import type { HookInput, IngestEnvelope, TranscriptUsage } from "@lb/core";
import { sha1 } from "../hash";
import type { Normalized } from "../normalize";
import { capLines, tailLines } from "../normalize/text";
import { taskFields } from "./task-fields";

export type EnvelopeContext = {
  repo: string;
  branch: string;
  machine: string;
  normalized?: Normalized;
  tokens?: number;
  usage?: TranscriptUsage;
  now: number;
};

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function exitCodeOf(input: HookInput, resp: Record<string, unknown>): number {
  const raw = [resp.exit_code, resp.exitCode, resp.code].find((v) => typeof v === "number");
  const code = typeof raw === "number" ? raw : undefined;
  if (input.hook_event_name === "PostToolUseFailure") return code && code !== 0 ? code : 1;
  return code ?? (resp.interrupted === true ? 130 : 0);
}

function outputTailOf(input: HookInput, rawResponse: unknown): string | undefined {
  const resp = rec(rawResponse);
  const parts = [str(resp.stdout), str(resp.stderr), str(rec(input).error), str(rawResponse)].filter(
    (s): s is string => !!s && s.trim().length > 0,
  );
  return parts.length ? tailLines(parts.join("\n")) : undefined;
}

export function eventKey(input: HookInput, now: number): string {
  const toolUseId = "tool_use_id" in input ? input.tool_use_id : undefined;
  // Task hooks carry no tool_use_id; the task id keeps two hooks in the same millisecond apart.
  const taskId = "task_id" in input && input.task_id !== undefined ? `${input.task_id}@` : "";
  return sha1(`${input.session_id}|${input.hook_event_name}|${toolUseId ?? `${taskId}${now}`}`);
}

export function buildEnvelope(input: HookInput, ctx: EnvelopeContext): IngestEnvelope {
  const n = ctx.normalized;
  const env: IngestEnvelope = {
    v: 1,
    eventKey: eventKey(input, ctx.now),
    hook: input.hook_event_name,
    session: {
      claudeSessionId: input.session_id,
      repo: ctx.repo,
      branch: ctx.branch,
      machine: ctx.machine,
      cwd: input.cwd,
    },
    files: n?.files ?? [],
    touches: n?.touches ?? [],
    references: n?.references ?? [],
    at: ctx.now,
  };
  if (n?.preview) env.preview = n.preview;
  const { task, todos } = taskFields(input);
  if (task) env.task = task;
  if (todos) env.todos = todos;
  if (ctx.usage && Object.keys(ctx.usage.toolTokens).length) env.toolTokens = ctx.usage.toolTokens;
  if (ctx.usage) env.turnTokens = ctx.usage.turnTokens;

  switch (input.hook_event_name) {
    case "UserPromptSubmit":
      env.prompt = input.prompt.slice(0, 2000);
      break;
    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure": {
      env.tool = input.tool_name;
      if (input.tool_use_id) env.toolUseId = input.tool_use_id;
      if (input.tool_name !== "Bash") break;
      const command = str(input.tool_input.command) ?? "";
      env.command = command;
      env.preview = capLines(command);
      if (input.hook_event_name === "PreToolUse") break;
      const resp = rec(input.tool_response);
      env.exitCode = exitCodeOf(input, resp);
      const tail = outputTailOf(input, input.tool_response);
      if (tail) env.outputTail = tail;
      break;
    }
    case "Stop":
      env.stopHookActive = input.stop_hook_active ?? false;
      if (input.last_assistant_message) env.preview = capLines(input.last_assistant_message);
      if (ctx.tokens !== undefined) env.tokens = ctx.tokens;
      break;
    default:
      break;
  }
  return env;
}
