import {
  type AgentEvent,
  addUsage,
  assistantEntry,
  assistantMessage,
  type ChatMessage,
  type ChatModel,
  type ChatUsage,
  costUsd,
  hookContext,
  openingPrompt,
  type Price,
  promptEntry,
  stopBlockReason,
  TOOL_SCHEMAS,
  toolResultEntry,
} from "@lb/core";
import type { Emit } from "./emit";
import type { HookBridge } from "./hooks";
import { type RetryOptions, withRetry } from "./providers/retry";
import { toolStep } from "./tool-step";

export type AgentRun = {
  model: ChatModel;
  sessionId: string;
  cwd: string;
  prompt: string;
  system: string;
  hooks: HookBridge;
  /** Only reported in the start event; a disabled bridge already answers every hook with null. */
  hooksEnabled: boolean;
  emit: Emit;
  transcript: (entry: Record<string, unknown>) => void;
  maxTurns: number;
  maxBudgetUsd?: number;
  price: Price;
  /** The eval harness sends SessionEnd itself once every agent is done, as its Claude plugin does. */
  holdSessionEnd?: boolean;
  retry?: RetryOptions;
};

type Final = Extract<AgentEvent, { type: "final" }>;
const ZERO: ChatUsage = { input: 0, output: 0, cached: 0 };
const NUDGE =
  "You replied with nothing. Call a tool to continue the task, or reply with a short summary if it is done.";

/** The agent loop. Never throws: provider failures end the run with reason "error", hooks fail open. */
export async function runAgent(r: AgentRun): Promise<Final> {
  const { emit, hooks } = r;
  let total = ZERO;
  let turns = 0;
  let lastText = "";
  const finish = (reason: Final["reason"]): Final => {
    const e: Final = {
      type: "final",
      reason,
      text: lastText,
      turns,
      tokens: total,
      costUsd: costUsd(total, r.price),
    };
    emit(e);
    return e;
  };
  const context = (hook: string, out: unknown): string => {
    const text = hookContext(out);
    if (text) emit({ type: "lb_context", hook, text });
    return text;
  };
  emit({
    type: "start",
    sessionId: r.sessionId,
    provider: r.model.provider,
    model: r.model.model,
    cwd: r.cwd,
    hooks: r.hooksEnabled,
  });
  try {
    const startCtx = context("SessionStart", await hooks("SessionStart", { source: "startup" }));
    r.transcript(promptEntry(r.prompt, r.sessionId));
    const promptCtx = context("UserPromptSubmit", await hooks("UserPromptSubmit", { prompt: r.prompt }));
    const messages: ChatMessage[] = [{ role: "user", text: openingPrompt(r.prompt, [startCtx, promptCtx]) }];
    let stopBlocked = false;
    let nudged = false;
    while (turns < r.maxTurns) {
      turns++;
      emit({ type: "turn", n: turns });
      const turn = await withRetry(
        () => r.model.complete({ system: r.system, messages, tools: TOOL_SCHEMAS }),
        {
          ...r.retry,
          onRetry: (e, wait, attempt) => {
            emit({
              type: "error",
              message: `retry ${attempt} in ${Math.round(wait / 1000)} s: ${String(e).slice(0, 300)}`,
            });
          },
        },
      );
      total = addUsage(total, turn.usage);
      emit({ type: "usage", id: turn.id, turn: turn.usage, total, costUsd: costUsd(total, r.price) });
      r.transcript(assistantEntry(turn, r.sessionId, r.model.model));
      messages.push(assistantMessage(turn));
      if (turn.text) {
        lastText = turn.text;
        emit({ type: "assistant", text: turn.text });
      }
      if (r.maxBudgetUsd !== undefined && costUsd(total, r.price) >= r.maxBudgetUsd) return finish("budget");
      if (turn.malformed) {
        messages.push({ role: "user", text: turn.malformed });
        continue;
      }
      if (turn.toolCalls.length === 0) {
        if (!turn.text && !nudged) {
          nudged = true;
          messages.push({ role: "user", text: NUDGE });
          continue;
        }
        const out = await hooks("Stop", { stop_hook_active: stopBlocked, last_assistant_message: turn.text });
        const reason = stopBlockReason(out);
        if (reason && !stopBlocked) {
          stopBlocked = true;
          emit({ type: "lb_stop_block", reason });
          r.transcript(promptEntry(reason, r.sessionId));
          messages.push({ role: "user", text: reason });
          continue;
        }
        return finish("done");
      }
      for (const call of turn.toolCalls) {
        const step = await toolStep(call, r.cwd, hooks, emit);
        r.transcript(toolResultEntry(call.id, step.text, !step.ok, r.sessionId));
        messages.push({ role: "tool", callId: call.id, name: call.name, text: step.text });
      }
    }
    return finish("max_turns");
  } catch (e) {
    emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
    return finish("error");
  } finally {
    if (!r.holdSessionEnd) await hooks("SessionEnd", { reason: "other" });
  }
}
