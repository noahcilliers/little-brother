/**
 * Claude Code transcripts for the replayed sessions, so Stop and SessionEnd can price each tool call the way they
 * do live. Each Stop/SessionEnd line gets a snapshot of its agent's transcript up to that moment (the file the
 * hook would read), referenced by the line's `transcript` field; `lb replay` points transcript_path at it.
 * Usage numbers are deterministic estimates from payload sizes: output ≈ the call's input, new input ≈ the
 * previous tool result, plus the cached context Claude Code re-reads every turn (cache reads, never counted).
 */
import { createHash } from "node:crypto";
import type { ScenarioLine } from "./events";

type Entry = Record<string, unknown>;

const SYSTEM_CONTEXT = 14_000;
const tokensOf = (chars: number) => Math.ceil(chars / 3.8);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Entry) : {};

/** The compact tool input a transcript would show (paths and commands, not whole file bodies). */
function shownInput(input: Entry): Entry {
  const ti = rec(input.tool_input);
  const keep = ["file_path", "command", "description", "taskId", "status", "subject"];
  return Object.fromEntries(Object.entries(ti).filter(([k]) => keep.includes(k)));
}

/** What the call put into the model's context: payload size drives the token estimates. */
function payloadChars(input: Entry): number {
  return JSON.stringify(input.tool_input ?? {}).length;
}

class Session {
  readonly entries: Entry[] = [];
  private pendingInput = 0;
  private cached = SYSTEM_CONTEXT;

  constructor(private readonly id: string) {}

  prompt(text: string): void {
    this.entries.push({ type: "user", message: { role: "user", content: text } });
    this.pendingInput += tokensOf(text.length);
  }

  call(step: string, toolUseId: string, name: string, input: Entry, resultChars: number): void {
    // Thinking plus the call itself: writes cost their content, reads and commands mostly the reasoning.
    const output = 120 + (Number.parseInt(hash(step).slice(2, 5), 16) % 400) + tokensOf(payloadChars(input));
    const created = 60 + this.pendingInput;
    const usage = {
      input_tokens: 3 + (Number.parseInt(hash(step).slice(0, 2), 16) % 9),
      cache_creation_input_tokens: created,
      cache_read_input_tokens: this.cached,
      output_tokens: output,
    };
    this.cached += created + output;
    const message = { id: `msg_${hash(`${this.id}:${step}`).slice(0, 24)}`, role: "assistant", usage };
    this.entries.push({ type: "assistant", message: { ...message, content: [{ type: "text", text: "…" }] } });
    this.entries.push({
      type: "assistant",
      message: { ...message, content: [{ type: "tool_use", id: toolUseId, name, input: shownInput(input) }] },
    });
    this.entries.push({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: "…" }] },
    });
    this.pendingInput = tokensOf(Math.min(resultChars, 24_000));
  }

  reply(step: string, text: string): void {
    const usage = {
      input_tokens: 4,
      cache_creation_input_tokens: 60 + this.pendingInput,
      output_tokens: tokensOf(text.length) + 20,
    };
    this.entries.push({
      type: "assistant",
      message: {
        id: `msg_${hash(`${this.id}:${step}`).slice(0, 24)}`,
        role: "assistant",
        usage,
        content: [{ type: "text", text }],
      },
    });
    this.pendingInput = 0;
  }
}

/** Snapshot per Stop/SessionEnd step: the agent's transcript JSONL at that point. */
export function transcriptsFor(lines: ScenarioLine[]): Map<string, string> {
  const sessions = new Map<string, Session>();
  const resultChars = new Map<string, number>();
  for (const l of lines) {
    if (!("input" in l) || l.input.hook_event_name === "PreToolUse") continue;
    if (typeof l.input.tool_use_id === "string")
      resultChars.set(
        l.input.tool_use_id,
        JSON.stringify(l.input.tool_response ?? l.input.error ?? "").length,
      );
  }
  const seen = new Set<string>();
  const out = new Map<string, string>();
  for (const l of lines) {
    if (!("input" in l)) continue;
    const s = sessions.get(l.as) ?? new Session(l.as);
    sessions.set(l.as, s);
    const input = l.input;
    const hook = input.hook_event_name;
    const id = typeof input.tool_use_id === "string" ? input.tool_use_id : undefined;
    if (hook === "UserPromptSubmit") s.prompt(String(input.prompt ?? ""));
    else if (id && !seen.has(id) && typeof input.tool_name === "string") {
      seen.add(id);
      // A denied call has no result; the denial reason comes back instead (≈ 300 chars).
      s.call(l.step, id, input.tool_name, input, resultChars.get(id) ?? 300);
    } else if (hook === "TaskCreated") {
      s.call(
        l.step,
        `toolu_task_${hash(l.step).slice(0, 18)}`,
        "TaskCreate",
        { tool_input: { subject: input.task_subject } },
        80,
      );
    } else if (hook === "Stop") s.reply(l.step, String(input.last_assistant_message ?? ""));
    if (hook === "Stop" || hook === "SessionEnd")
      out.set(l.step, `${s.entries.map((e) => JSON.stringify(e)).join("\n")}\n`);
  }
  return out;
}
