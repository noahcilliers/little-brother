import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { BRANCH, type Handle, type SeedAct, type SeedTask } from "./devSeedStory";
import { demoSession } from "./migrateRooms";

// Dev only: row writers for devSeed. Every row hangs off an agent whose session id starts with TAG.

export const TAG = "devseed";
const UNIT_MS = 3000; // one story second; keeps idle gaps under the board's 20 s compression threshold
export const REPO = "lb-demo-shop";
const EMPTY = { files: [], touches: [], references: [] };

export type Story = {
  ctx: MutationCtx;
  now: number;
  at: number;
  agent: Record<Handle, Id<"agents">>;
  teamId: Id<"teams">;
  handles: Handle[];
  /** Story seconds → wall-clock ms. */
  T: (s: number) => number;
  seen: (s: number | undefined) => boolean;
};

export async function memberFor(ctx: MutationCtx, handle: string): Promise<Id<"members">> {
  const have = await ctx.db
    .query("members")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .first();
  if (have) return have._id;
  return ctx.db.insert("members", { name: handle, handle, tokenHash: `${TAG}:${handle}`, revoked: false });
}

export async function startStory(ctx: MutationCtx, at: number, handles: Handle[]): Promise<Story> {
  const now = Date.now();
  const base = now - at * UNIT_MS - 500;
  const agent = {} as Record<Handle, Id<"agents">>;
  const scope = await demoSession(ctx);
  for (const h of handles) {
    agent[h] = await ctx.db.insert("agents", {
      teamId: scope.teamId,
      sessionId: scope._id,
      memberId: await memberFor(ctx, h),
      claudeSessionId: `${TAG}-${h}-${now}`,
      machine: TAG,
      repo: REPO,
      branch: BRANCH[h],
      status: "active",
      lastSeenAt: now,
    });
  }
  return {
    ctx,
    now,
    at,
    agent,
    teamId: scope.teamId,
    handles,
    T: (s) => Math.round(base + s * UNIT_MS),
    seen: (s) => s !== undefined && s <= at,
  };
}

type EventRest = Partial<{
  tool: string;
  files: string[];
  nodeId: Id<"nodes">;
  summary: string;
  source: "hook" | "human";
  tokens: number;
  payload: unknown;
}>;
export function writeEvent(s: Story, a: Handle, t: number, hook: string, rest: EventRest) {
  return s.ctx.db.insert("events", {
    agentId: s.agent[a],
    eventKey: `${TAG}:${s.now}:${a}:${t}:${hook}`,
    source: "hook",
    hook,
    files: [],
    summary: hook,
    payload: {},
    at: s.T(t),
    ...rest,
  });
}

export async function writeNode(
  s: Story,
  a: Handle,
  t: number,
  row: { kind: "intent" | "knowledge" | "action"; text: string; parentId?: Id<"nodes"> },
) {
  const [verb = "PLAN", topic] = row.text.split(" ");
  return s.ctx.db.insert("nodes", {
    ...EMPTY,
    agentId: s.agent[a],
    teamId: s.teamId,
    kind: row.kind,
    verb,
    text: row.text,
    topic: row.kind === "action" ? undefined : topic,
    parentId: row.parentId,
    outcome: row.kind === "intent" ? "open" : "succeeded",
    at: s.T(t),
  });
}

// Until the schema carries per-action token counts, the seed puts a plausible one on the hook event.
function tokenGuess(x: SeedAct): number {
  if (x.tool === "Read") return 220 + x.target.length * 6;
  if (x.tool === "Bash") return 380;
  return 520 + x.label.length * 38;
}

/** One tool call: the action node, its PreToolUse event (with the denial, if any) and a Bash result. */
async function writeAct(
  s: Story,
  k: SeedTask,
  x: SeedAct,
  taskId: Id<"tasks">,
  goalId: Id<"nodes"> | undefined,
) {
  const bash = x.tool === "Bash";
  const files = bash ? [] : [x.target];
  const first = x.label.split(" ")[0]?.toUpperCase() ?? "EDIT";
  const verb = first === "READ" ? "EXPLORE" : first;
  const nodeId = await s.ctx.db.insert("nodes", {
    ...EMPTY,
    agentId: s.agent[k.a],
    teamId: s.teamId,
    kind: "action",
    verb,
    text: `${verb} ${k.topic} ${x.target}${x.outcome === "failed" ? " → FAIL" : ""}`,
    topic: k.topic,
    files,
    parentId: goalId,
    outcome: x.outcome,
    taskId,
    label: x.label,
    preview: x.preview,
    at: s.T(x.t),
  });
  const envelope = { tool: x.tool, files, command: bash ? x.target : undefined, outputTail: x.tail };
  const reason = `[little-brother] ${x.deny}`;
  const output = x.deny
    ? {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }
    : null;
  const summary = `${x.deny ? "denied " : ""}${x.tool} ${x.target}`;
  await writeEvent(s, k.a, x.t, "PreToolUse", {
    tokens: x.tokens ?? tokenGuess(x),
    tool: x.tool,
    files,
    nodeId,
    summary,
    payload: { envelope, output },
  });
  if (bash) {
    const result = `${summary} → ${x.outcome === "failed" ? "FAIL" : "OK"}`;
    const payload = { envelope, output: null };
    await writeEvent(s, k.a, x.t + 0.01, "PostToolUse", { tool: x.tool, nodeId, summary: result, payload });
  }
  return nodeId;
}

/** A task as far as the story has got: open while `at` is inside it, superseded only once the decision lands. */
export async function writeTask(s: Story, k: SeedTask, goalId: Id<"nodes"> | undefined) {
  const done = s.seen(k.t1);
  const pending = k.status === "superseded" && !s.seen(k.supersededAt);
  const status = !done ? "in_progress" : pending ? "completed" : k.status;
  const taskId = await s.ctx.db.insert("tasks", {
    agentId: s.agent[k.a],
    taskKey: `${TAG}:${k.key}`,
    subject: k.subject,
    status,
    goalId,
    source: "task_tool",
    startedAt: s.T(k.t0),
    endedAt: done ? s.T(k.t1) : undefined,
    note: done ? k.note : undefined,
  });
  // The agent marks the step in progress on its task list: a routine tick at the bar's start.
  const payload = { envelope: { tool: "TaskUpdate" }, output: null };
  const summary = `TaskUpdate "${k.subject}" in_progress`;
  await writeEvent(s, k.a, k.t0 + 0.05, "PostToolUse", { tool: "TaskUpdate", summary, payload });
  const acts: Id<"nodes">[] = [];
  for (const x of k.acts) if (s.seen(x.t)) acts.push(await writeAct(s, k, x, taskId, goalId));
  return acts;
}
