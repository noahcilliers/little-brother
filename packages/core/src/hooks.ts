import { z } from "zod";

/** Contract 1 — what Claude Code writes to a hook's stdin. Unknown fields pass through. */
const common = {
  session_id: z.string(),
  transcript_path: z.string().optional(),
  cwd: z.string(),
  hook_event_name: z.string(),
};

export const HookInput = z.discriminatedUnion("hook_event_name", [
  z
    .object({ ...common, hook_event_name: z.literal("SessionStart"), source: z.string().optional() })
    .passthrough(),
  z.object({ ...common, hook_event_name: z.literal("UserPromptSubmit"), prompt: z.string() }).passthrough(),
  z
    .object({
      ...common,
      hook_event_name: z.literal("PreToolUse"),
      tool_name: z.string(),
      tool_input: z.record(z.unknown()),
      tool_use_id: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      ...common,
      hook_event_name: z.enum(["PostToolUse", "PostToolUseFailure"]),
      tool_name: z.string(),
      tool_input: z.record(z.unknown()),
      tool_response: z.unknown().optional(),
      tool_use_id: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      ...common,
      hook_event_name: z.literal("Stop"),
      stop_hook_active: z.boolean().optional(),
      last_assistant_message: z.string().optional(),
    })
    .passthrough(),
  z
    .object({ ...common, hook_event_name: z.literal("SessionEnd"), reason: z.string().optional() })
    .passthrough(),
  // Task-list hooks. Field shapes are only partly documented, so every task field is optional and ids may be numbers.
  z
    .object({
      ...common,
      hook_event_name: z.enum(["TaskCreated", "TaskCompleted"]),
      task_id: z.union([z.string(), z.number()]).optional(),
      task_subject: z.string().optional(),
      task_description: z.string().optional(),
      teammate_name: z.string().optional(),
      team_name: z.string().optional(),
    })
    .passthrough(),
]);
export type HookInput = z.infer<typeof HookInput>;
export type HookEventName = HookInput["hook_event_name"];

/** Contract 3 — what `lb hook` prints to stdout. `null` means print nothing. */
export type HookOutput =
  | {
      hookSpecificOutput: {
        hookEventName: "PreToolUse";
        permissionDecision: "deny";
        permissionDecisionReason: string;
      };
    }
  | {
      hookSpecificOutput: {
        hookEventName: "SessionStart" | "UserPromptSubmit" | "PostToolUse";
        additionalContext: string;
      };
    }
  | { decision: "block"; reason: string }
  | null;

export const deny = (reason: string): HookOutput => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

export const context = (
  hookEventName: "SessionStart" | "UserPromptSubmit" | "PostToolUse",
  text: string,
): HookOutput => (text ? { hookSpecificOutput: { hookEventName, additionalContext: text } } : null);

export const blockStop = (reason: string): HookOutput => ({ decision: "block", reason });
