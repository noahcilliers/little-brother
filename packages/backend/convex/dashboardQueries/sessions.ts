import { cleanPrompt } from "@lb/core";
import type { Doc } from "../_generated/dataModel";
import { clip, lbSentence } from "./labels";
import { payloadField, payloadString } from "./shared";
import type { Source } from "./source";
import type { BoardTask } from "./tasks";

export type LineKind = "prompt" | "task" | "done" | "tool" | "ok" | "fail" | "lb" | "lbwarn" | "decide";
export type SessionLine = {
  id: string;
  t: number;
  kind: LineKind;
  text: string;
  head?: string;
  task?: string;
};
export type Session = { agentId: string; lines: SessionLine[] };

const LINES_PER_AGENT = 160;
// Task-list tools already appear as ☐/☑ lines from the tasks table; reads are context, not work.
const QUIET_TOOLS = new Set([
  "TaskCreate",
  "TaskUpdate",
  "TaskList",
  "TaskGet",
  "TodoWrite",
  "Read",
  "Grep",
  "Glob",
  "LS",
]);
const END_MARK: Record<BoardTask["state"], string> = {
  running: "",
  done: "",
  abandoned: " · abandoned",
  stopped: " · stopped",
  superseded: " · superseded",
};

function target(e: Doc<"events">): string {
  const cmd = payloadString(e, "envelope", "command");
  return clip(e.files[0] ?? cmd ?? "", 48);
}

/** The line of a command's output that says how it went: a test summary or an error, else the last line. */
function resultLine(text: string | undefined): string {
  const lines = (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const pick =
    [...lines].reverse().find((l) => /\d+ (passed|failed)\b|\bError:/.test(l)) ?? lines.pop() ?? "";
  return clip(pick.replace(/^Tests?\s+/, ""), 90);
}

/** One line per thing the developer would see in that agent's Claude Code session. */
function eventLine(e: Doc<"events">, src: Source, taskOf: Map<string, string>): SessionLine | undefined {
  const base = { id: e._id, t: e.at, task: e.nodeId ? taskOf.get(e.nodeId) : undefined };
  const tool = e.tool ?? "";
  const call = `${tool}(${target(e)})`;
  if (e.hook === "UserPromptSubmit") {
    return {
      ...base,
      kind: "prompt",
      text: cleanPrompt(payloadString(e, "envelope", "prompt") ?? e.summary),
    };
  }
  if (e.hook === "PreToolUse") {
    const reason = payloadString(e, "output", "hookSpecificOutput", "permissionDecisionReason");
    if (reason) return { ...base, kind: "lb", head: "denied", text: `${call}: ${lbSentence(reason)}` };
    if (QUIET_TOOLS.has(tool) || tool === "Bash") return undefined;
    const node = e.nodeId ? src.nodeById.get(e.nodeId) : undefined;
    const symbol = node?.label?.split(" ").slice(1).join(" ");
    return { ...base, kind: "tool", text: symbol ? `${call} · ${symbol}` : call };
  }
  if (e.hook === "PostToolUse" || e.hook === "PostToolUseFailure") {
    const failed = e.summary.endsWith("FAIL") || e.hook === "PostToolUseFailure";
    if (QUIET_TOOLS.has(tool) || (tool !== "Bash" && !failed)) return undefined;
    const tail = resultLine(payloadString(e, "envelope", "outputTail")).replace(/^[✓✕]\s*/, "");
    const mark = failed ? "✕" : "✓";
    return { ...base, kind: failed ? "fail" : "ok", text: `${call} ⎿ ${mark}${tail ? ` ${tail}` : ""}` };
  }
  if (e.hook === "Stop" && payloadField(e, "output", "decision") === "block") {
    const reason = payloadString(e, "output", "reason") ?? "";
    return { ...base, kind: "lbwarn", head: "held", text: lbSentence(reason) };
  }
  if (e.source === "mcp" && tool)
    return { ...base, kind: "decide", text: `little-brother.${tool}(${e.summary})` };
  if (e.hook === "Resolve") {
    return {
      ...base,
      kind: "decide",
      text: `decided on the dashboard: ${e.summary.replace(/^DECIDE\s+/, "")}`,
    };
  }
  return undefined;
}

function taskLines(t: BoardTask): SessionLine[] {
  if (t.inferred) return [];
  const lines: SessionLine[] = [
    { id: `${t.id}:start`, t: t.t0, kind: "task", text: `☐ ${t.subject}`, task: t.id },
  ];
  if (t.t1 !== null && t.state !== "running") {
    const box = t.state === "done" || t.state === "superseded" ? "☑" : "☒";
    const mark = t.state === "superseded" ? "" : END_MARK[t.state];
    lines.push({ id: `${t.id}:end`, t: t.t1, kind: "done", text: `${box} ${t.subject}${mark}`, task: t.id });
  }
  return lines;
}

function inboxLine(i: Doc<"inbox">, src: Source, taskOf: Map<string, string>): SessionLine {
  const c = src.verdicts.find((v) => v._id === i.classificationId);
  const mine = [c?.nodeId, c?.againstNodeId].find((id) => id && src.nodeById.get(id)?.agentId === i.agentId);
  const decided = /\bresolved\b|\bdecided\b/i.test(i.text);
  return {
    id: i._id,
    t: i.at,
    kind: "lbwarn",
    head: decided ? "decided" : (c?.type ?? "warn"),
    text: lbSentence(i.text),
    task: mine ? taskOf.get(mine) : undefined,
  };
}

/** Each agent's session, oldest first, as the bottom panes show it. */
export function buildSessions(src: Source, tasks: BoardTask[], taskOf: Map<string, string>): Session[] {
  const order: Record<LineKind, number> = {
    prompt: 0,
    task: 1,
    tool: 2,
    lbwarn: 3,
    lb: 3,
    ok: 4,
    fail: 4,
    decide: 5,
    done: 6,
  };
  return src.agents.map((a) => {
    const lines = [
      ...src.events.filter((e) => e.agentId === a._id).map((e) => eventLine(e, src, taskOf)),
      ...tasks.filter((t) => t.agentId === a._id).flatMap(taskLines),
      ...src.inbox.filter((i) => i.agentId === a._id).map((i) => inboxLine(i, src, taskOf)),
    ]
      .filter((l): l is SessionLine => l !== undefined)
      .sort((x, y) => x.t - y.t || order[x.kind] - order[y.kind]);
    return { agentId: a._id, lines: lines.slice(-LINES_PER_AGENT) };
  });
}
