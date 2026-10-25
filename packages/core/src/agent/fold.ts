// How a Claude-Code-shaped hook output reaches a model that isn't Claude Code: a deny replaces the tool's
// result, additional context rides along with whatever the model reads next, a Stop block becomes a prompt.

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export const BLOCKED_PREFIX = "Blocked by Little Brother: ";

/** The PreToolUse deny reason, if the hook denied the call. */
export function denyReason(output: unknown): string | undefined {
  const h = rec(rec(output).hookSpecificOutput);
  if (h.permissionDecision !== "deny") return undefined;
  return str(h.permissionDecisionReason) || "denied";
}

/** additionalContext from SessionStart, UserPromptSubmit or PostToolUse; "" when there is none. */
export const hookContext = (output: unknown): string =>
  str(rec(rec(output).hookSpecificOutput).additionalContext).trim();

/** The reason a Stop hook blocked stopping, if it did. */
export function stopBlockReason(output: unknown): string | undefined {
  const o = rec(output);
  return o.decision === "block" ? str(o.reason) || "Little Brother asked you to continue." : undefined;
}

export const blockedResult = (reason: string): string =>
  `${BLOCKED_PREFIX}${reason}\nDo not retry this call; adapt your plan to it.`;

/** A tool result with hook context appended, so the model reads it on its next turn. */
export const withContext = (result: string, context: string): string =>
  context ? `${result}\n\n<little-brother-context>\n${context}\n</little-brother-context>` : result;

/** The opening user message: the task, preceded by whatever SessionStart and UserPromptSubmit added. */
export function openingPrompt(prompt: string, contexts: string[]): string {
  const ctx = contexts.filter(Boolean);
  if (!ctx.length) return prompt;
  return `${ctx.map((c) => `<little-brother-context>\n${c}\n</little-brother-context>`).join("\n\n")}\n\n${prompt}`;
}
