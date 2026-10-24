import { McpArgs } from "@lb/core";
import { z } from "zod";
import { activeProfile } from "../config";
import { sessionCodeFor } from "../hook/attach";
import { readSessionId } from "../hook/session-file";
import { postJson } from "../http";

export type ToolName = keyof typeof McpArgs;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  status: "Who on the team is doing what right now, open conflicts, and recent failures relevant to you.",
  inbox: "Your undelivered and unacked little-brother items (warnings, serialize/block notices, answers).",
  ack: "Acknowledge an inbox item after acting on it. outcome: acked (seen), applied (changed course), rejected (disagree, add note).",
  post_knowledge:
    "Share a durable fact about the codebase other agents should know (≤500 chars), with the files it concerns.",
  post_decision: "Record a team decision on a topic (e.g. auth.mech = jwt-bearer) with a short rationale.",
  report_failure:
    "Record an approach that failed: what you tried, why it failed, and what worked instead if known.",
  ask: "Ask another agent or the team a question; optionally address a member handle with `to`.",
  answer: "Answer a question another agent asked you, by questionId.",
};

const ToolResponse = z.object({ text: z.string() });

export type CallOptions = { as?: string; claudeSessionId?: string };

/** Every MCP tool is a thin POST; the backend owns all logic and renders the reply text. */
export async function callTool(tool: ToolName, args: unknown, opts: CallOptions = {}): Promise<string> {
  const p = activeProfile(opts.as);
  if (!p) return "little-brother is not set up on this machine: run `lb join --url <siteUrl> --as <handle>`.";
  const claudeSessionId = opts.claudeSessionId ?? readSessionId();
  if (!opts.as && !sessionCodeFor(claudeSessionId))
    return "This Claude session has not joined a Little Brother session, so nothing is shared. If the user wants coordination, they run /little-brother:join <code> (the code is on their dashboard).";
  const body = { claudeSessionId, args: McpArgs[tool].parse(args) };
  const res = ToolResponse.parse(
    await postJson(`${p.siteUrl}/mcp/${tool}`, body, { token: p.token, timeoutMs: 8000 }),
  );
  return res.text;
}
