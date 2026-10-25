import {
  blockedResult,
  denyReason,
  hookContext,
  isToolName,
  parseToolArgs,
  type ToolCall,
  withContext,
} from "@lb/core";
import type { Emit } from "./emit";
import { FAILURE_HOOK, type HookBridge, POST_TOOL_HOOK, PRE_TOOL_HOOK } from "./hooks";
import { runTool } from "./tools";

const MAX_EVENT_TEXT = 4000;

export type StepResult = { text: string; ok: boolean };

/**
 * One tool call through the same hook sequence Claude Code runs: PreToolUse (a deny skips the tool and its
 * reason becomes the result), the tool, then PostToolUse or, for a failed Bash, PostToolUseFailure, whose
 * context is appended to the result. Arguments that don't validate never reach the hooks, as in Claude Code.
 */
export async function toolStep(
  call: ToolCall,
  cwd: string,
  hooks: HookBridge,
  emit: Emit,
): Promise<StepResult> {
  emit({ type: "tool_call", id: call.id, name: call.name, input: call.args });
  const done = (r: StepResult): StepResult => {
    emit({
      type: "tool_result",
      id: call.id,
      name: call.name,
      ok: r.ok,
      text: r.text.slice(0, MAX_EVENT_TEXT),
    });
    return r;
  };
  const name = call.name;
  const parsed = parseToolArgs(name, call.args);
  if (!parsed.ok || !isToolName(name))
    return done({ ok: false, text: `Error: ${parsed.ok ? "unknown tool" : parsed.error}` });
  const base = { tool_name: call.name, tool_input: parsed.input, tool_use_id: call.id };
  if (PRE_TOOL_HOOK.has(call.name)) {
    const reason = denyReason(await hooks("PreToolUse", base));
    if (reason) {
      emit({ type: "lb_deny", id: call.id, name: call.name, reason });
      return done({ ok: false, text: blockedResult(reason) });
    }
  }
  const outcome = await runTool(name, parsed.input, cwd);
  const event = outcome.ok ? "PostToolUse" : "PostToolUseFailure";
  const hooked = outcome.ok ? POST_TOOL_HOOK.has(call.name) : FAILURE_HOOK.has(call.name);
  let text = outcome.ok ? outcome.text : `Error: ${outcome.text}`;
  if (hooked) {
    const out = await hooks(event, {
      ...base,
      tool_response: outcome.response,
      ...(outcome.ok ? {} : { error: outcome.text.slice(0, 2000) }),
    });
    const ctx = hookContext(out);
    if (ctx) {
      emit({ type: "lb_context", hook: event, text: ctx });
      text = withContext(text, ctx);
    }
  }
  return done({ ok: outcome.ok, text });
}
