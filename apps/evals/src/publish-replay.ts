import type { ReplayEvent, ReplayKind } from "@lb/core";
import { cleanLine } from "./publish-text";

// A run's agent streams (Claude Code stream-json) and hook timing logs, folded into one short, ordered
// timeline the landing can replay like a terminal.

export type AgentFiles = { handle: string; stream: string; hooks: string };

const LB_MARK = "[little-brother]";
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const TEST_CMD =
  /\b(pytest|vitest|jest|runtests|npm (run )?test|pnpm (run )?test|tsc|typecheck|go test|cargo test)\b/;
// The coordination calls an agent makes on purpose, as opposed to reading its inbox or status.
const LB_ACTIONS = /__(post_decision|post_knowledge|report_failure|ask|answer)$/;
/** Enough rows to tell the story; a long run's reads and greps are thinned, never its catches. */
export const MAX_EVENTS = 48;

type Raw = { at: number; agent: string; kind: ReplayKind; text: string };

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function parseLines(text: string): Record<string, unknown>[] {
  return text.split("\n").flatMap((l) => {
    if (!l.trim()) return [];
    try {
      return [rec(JSON.parse(l))];
    } catch {
      return [];
    }
  });
}

function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => str(rec(c).text)).join("\n");
  return "";
}

/** The Little Brother message inside a hook error or context, without Claude Code's prefix. */
const lbMessage = (text: string): string | null => {
  const i = text.indexOf(LB_MARK);
  return i < 0 ? null : text.slice(i + LB_MARK.length).trim();
};

/** The model-facing text of a hook's stdout JSON: added context, or a deny or block reason. */
function hookOutputText(output: string): string {
  try {
    const o = rec(JSON.parse(output));
    const h = rec(o.hookSpecificOutput);
    return [str(h.additionalContext), str(h.permissionDecisionReason), str(o.reason)].join("\n");
  } catch {
    return output;
  }
}

function toolEvent(name: string, input: Record<string, unknown>): { kind: ReplayKind; text: string } {
  const target = str(input.file_path) || str(input.path) || str(input.pattern) || str(input.notebook_path);
  if (EDIT_TOOLS.has(name)) return { kind: "edit", text: `${name} ${target}` };
  if (name === "Bash") {
    // Only the first line is shown, so only the first line decides: a heredoc body can mention `npm test`.
    const cmd = str(input.command);
    const shown = cmd.split("\n").find((l) => l.trim()) ?? "";
    return { kind: TEST_CMD.test(shown) ? "test" : "tool", text: `$ ${cmd}` };
  }
  const lb = LB_ACTIONS.exec(name);
  if (lb) {
    const first = Object.values(input).find((v) => typeof v === "string") ?? "";
    return { kind: "decision", text: `lb.${lb[1]} ${str(first)}` };
  }
  return { kind: "tool", text: `${name.replace(/^mcp__\w+__/, "lb.")} ${target}`.trim() };
}

function streamEvents(a: AgentFiles, roots: string[]): Raw[] {
  const out: Raw[] = [];
  let last: number | null = null;
  for (const line of parseLines(a.stream)) {
    const ts = Date.parse(str(line.timestamp));
    if (Number.isFinite(ts)) last = ts;
    if (last === null) continue;
    const at = last;
    const push = (kind: ReplayKind, text: string) =>
      out.push({ at, agent: a.handle, kind, text: cleanLine(text, roots) });
    if (line.type === "system" && line.subtype === "hook_response" && line.hook_event !== "SessionStart") {
      const msg = lbMessage(hookOutputText(str(line.output)));
      if (msg) push("catch", msg);
      continue;
    }
    const content = rec(line.message).content;
    if (!Array.isArray(content)) continue;
    for (const raw of content) {
      const b = rec(raw);
      if (line.type === "assistant" && b.type === "tool_use") {
        const ev = toolEvent(str(b.name), rec(b.input));
        push(ev.kind, ev.text);
      } else if (line.type === "user" && b.type === "tool_result") {
        const msg = lbMessage(blockText(b.content));
        if (msg) push(b.is_error === true ? "deny" : "catch", msg);
      }
    }
  }
  return out;
}

/** Denies the stream didn't show (a hook's reason can be cut from the log), read from the timing file. */
function hookDenies(a: AgentFiles, seen: Raw[]): Raw[] {
  const denies = seen.filter((e) => e.kind === "deny");
  return parseLines(a.hooks).flatMap((h) => {
    const at = typeof h.at === "number" ? h.at : null;
    if (h.decision !== "deny" || at === null) return [];
    if (denies.some((d) => Math.abs(d.at - at) < 3000)) return [];
    return [{ at, agent: a.handle, kind: "deny" as const, text: `blocked ${str(h.tool) || "a tool call"}` }];
  });
}

function thin(events: Raw[]): Raw[] {
  if (events.length <= MAX_EVENTS) return events;
  const tools = events.filter((e) => e.kind === "tool");
  const budget = Math.max(0, MAX_EVENTS - (events.length - tools.length));
  const keep = new Set(
    Array.from({ length: budget }, (_, i) => tools[Math.floor((i * tools.length) / budget)]),
  );
  return events.filter((e) => e.kind !== "tool" || keep.has(e));
}

/**
 * Every agent's tool calls, edits, test runs and Little Brother messages, merged by time. `roots` are the
 * agents' worktree paths, stripped so lines read repo-relative.
 */
export function replayEvents(agents: AgentFiles[], roots: string[] = []): ReplayEvent[] {
  const cwds = agents.flatMap((a) =>
    parseLines(a.stream).flatMap((l) => (l.type === "system" && l.subtype === "init" ? [str(l.cwd)] : [])),
  );
  const all: Raw[] = [];
  for (const a of agents) {
    const own = streamEvents(a, [...roots, ...cwds]);
    all.push(...own, ...hookDenies(a, own));
  }
  // A deny shows up as a hook response and again as the tool result: keep one row, as the deny.
  const lbKey = (e: Raw) => `${e.agent}|${e.text}`;
  const denied = new Set(all.filter((e) => e.kind === "deny").map(lbKey));
  const seen = new Set<string>();
  const unique = all
    .filter((e) => e.text && !(e.kind === "catch" && denied.has(lbKey(e))))
    .sort((x, y) => x.at - y.at)
    .filter((e) => {
      if (e.kind !== "catch" && e.kind !== "deny") return true;
      const dup = seen.has(lbKey(e));
      seen.add(lbKey(e));
      return !dup;
    });
  const kept = thin(unique);
  const t0 = kept[0]?.at ?? 0;
  return kept.map((e) => ({ t: e.at - t0, agent: e.agent, kind: e.kind, text: e.text }));
}
