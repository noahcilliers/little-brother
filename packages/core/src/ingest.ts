import { z } from "zod";

export const Op = z.enum(["read", "write", "create", "delete", "rename", "signature_change"]);
export type Op = z.infer<typeof Op>;

/** One thing an event touches, computed on the developer's machine (classifier step 1). */
export const Touch = z.object({
  path: z.string(), // repo-relative
  symbol: z.string().optional(), // e.g. "src/auth/token.ts::issueToken"
  op: Op,
  lines: z.tuple([z.number(), z.number()]).optional(),
  newPath: z.string().optional(),
  generated: z.boolean().optional(),
});
export type Touch = z.infer<typeof Touch>;

/** A git operation observed in a Bash command (PostToolUse). Drives claim release and git status. */
export const GitOp = z.object({
  op: z.enum(["commit", "push", "merge", "rebase", "checkout", "pull"]),
  ok: z.boolean(),
  branch: z.string().optional(), // branch after the operation
  target: z.string().optional(), // push remote/branch, merge source, checkout target
  sha: z.string().optional(), // HEAD after the operation
  files: z.array(z.string()).default([]), // files included in a commit
});
export type GitOp = z.infer<typeof GitOp>;

export const TaskStatus = z.enum(["pending", "in_progress", "completed"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

/** One step of the agent's own task list, from TaskCreated/TaskCompleted or a TaskCreate/TaskUpdate call. */
export const TaskRef = z.object({
  key: z.string().min(1).max(200), // Claude Code task id, or `subject:<subject>` when the call carried no id
  subject: z.string().max(300).optional(), // TaskUpdate may carry only an id and a status
  description: z.string().max(1000).optional(),
  status: TaskStatus.optional(),
});
export type TaskRef = z.infer<typeof TaskRef>;

/** A TodoWrite snapshot entry (the legacy task list). */
export const TodoItem = z.object({
  content: z.string().max(300),
  status: TaskStatus,
  activeForm: z.string().max(300).optional(),
});
export type TodoItem = z.infer<typeof TodoItem>;

/** Contract 2 — `lb hook` → Convex `POST /hook/:event`. */
export const IngestEnvelope = z.object({
  v: z.literal(1),
  eventKey: z.string(), // idempotency
  hook: z.string(),
  session: z.object({
    claudeSessionId: z.string(),
    repo: z.string(),
    branch: z.string(),
    machine: z.string(),
    cwd: z.string(),
    lbSession: z.string().max(40).optional(), // the Little Brother session code this Claude session joined
  }),
  tool: z.string().optional(),
  toolUseId: z.string().optional(), // pairs PreToolUse with its PostToolUse
  topicMap: z.unknown().optional(), // the repo's .littlebrother.json, sent on SessionStart
  baseRev: z.string().optional(), // merge-base of HEAD with the default branch; line ranges are relative to it
  git: GitOp.optional(), // set on PostToolUse when a Bash command was a git operation
  reverted: z.array(z.string()).max(200).optional(), // repo paths a git checkout/restore/reset put back; "." = all
  files: z.array(z.string()),
  touches: z.array(Touch),
  references: z.array(z.string()),
  prompt: z.string().max(500).optional(),
  preview: z.string().max(4000).optional(), // ≤40 lines: diff hunk, command, or last message
  command: z.string().optional(),
  exitCode: z.number().optional(),
  outputTail: z.string().max(2000).optional(),
  stopHookActive: z.boolean().optional(),
  tokens: z.number().optional(),
  task: TaskRef.optional(), // TaskCreated / TaskCompleted, or a TaskCreate / TaskUpdate tool call
  todos: z.array(TodoItem).max(100).optional(), // TodoWrite snapshot
  toolTokens: z.record(z.number().nonnegative()).optional(), // Stop/SessionEnd/PreCompact: tool_use id → tokens
  turnTokens: z.number().nonnegative().optional(), // new tokens of the latest turn
  at: z.number(),
});
export type IngestEnvelope = z.infer<typeof IngestEnvelope>;

/** Response body of `/hook/:event`: the exact stdout object, or null for silence. */
export const IngestResponse = z.object({ output: z.unknown().nullable() });
