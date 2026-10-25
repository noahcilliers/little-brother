import { renderDigest } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { markDeliveredIds, queuedItems } from "./inbox";
import { sessionAgents } from "./sessionRows";

const MAX_LINES = 15;
// One line, injected once per session and only when there are teammates: every token here is re-read on
// every later turn, and the measured eval showed short sessions paying more for context than they saved.
const PROTOCOL = [
  "[little-brother] A denied edit says who owns the work and what exists; use it as described, no need to inspect their branch. Acks are optional.",
];

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function handleOf(ctx: QueryCtx, agent: Doc<"agents">): Promise<string> {
  const member = await ctx.db.get(agent.memberId);
  return member ? `@${member.handle}` : "@unknown";
}

async function teamLines(ctx: QueryCtx, me: Doc<"agents">): Promise<string[]> {
  if (!me.sessionId) return [];
  const lines: string[] = [];
  for (const a of await sessionAgents(ctx, me.sessionId)) {
    if (a._id === me._id || a.status === "offline") continue;
    const intent = a.intentId ? await ctx.db.get(a.intentId) : null;
    const git = a.git?.ok ? `, last ${a.git.op} ${(a.git.sha ?? "").slice(0, 7)}`.trimEnd() : "";
    lines.push(
      `- ${await handleOf(ctx, a)} (${a.branch}, ${a.status}${git}): ${clip(intent?.text ?? "no intent yet")}`,
    );
  }
  return lines;
}

async function conflictLines(ctx: QueryCtx, me: Doc<"agents">): Promise<string[]> {
  const open = await ctx.db
    .query("classifications")
    .withIndex("by_status", (q) => q.eq("status", "open"))
    .order("desc")
    .take(200);
  return open
    .filter((c) => c.type !== "normal" && c.agentIds.includes(me._id))
    .map((c) => `- ${c.type}: ${clip(c.reason)}`);
}

async function myFiles(ctx: QueryCtx, agentId: Id<"agents">): Promise<Set<string>> {
  const nodes = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(50);
  return new Set(nodes.flatMap((n) => n.files));
}

async function failureLines(ctx: QueryCtx, me: Doc<"agents">): Promise<string[]> {
  const files = await myFiles(ctx, me._id);
  const failed = await ctx.db
    .query("nodes")
    .withIndex("by_outcome", (q) => q.eq("outcome", "failed"))
    .order("desc")
    .take(100);
  const knowledge = failed.filter((n) => n.kind === "knowledge");
  const relevant = files.size > 0 ? knowledge.filter((n) => n.files.some((f) => files.has(f))) : knowledge;
  return relevant.slice(0, 3).map((n) => `- failed before: ${clip(n.text)}`);
}

const within = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/**
 * Teammates' Claude sessions working in the same folder on the same machine. They read each other's files off
 * disk mid-task, so neither agent's work is its own and duplicates vanish before anyone could flag them.
 */
async function sharedFolderLines(ctx: QueryCtx, me: Doc<"agents">): Promise<string[]> {
  if (!me.sessionId || !me.cwd) return [];
  const lines: string[] = [];
  for (const a of await sessionAgents(ctx, me.sessionId)) {
    if (a._id === me._id || a.status === "offline" || a.machine !== me.machine || !a.cwd) continue;
    if (within(a.cwd, me.cwd))
      lines.push(
        `- ${await handleOf(ctx, a)} is working in this same folder (${a.cwd}). Tell the user to give each Claude session its own copy, e.g. \`git worktree add ../${me.repo}-2 -b <branch>\`, before editing.`,
      );
  }
  return lines;
}

/** Who's doing what, what blocks me, what already failed; capped so it never floods the context. */
export async function teamDigest(ctx: QueryCtx, me: Doc<"agents">, withProtocol: boolean): Promise<string> {
  const team = await teamLines(ctx, me);
  const conflicts = await conflictLines(ctx, me);
  const failures = await failureLines(ctx, me);
  const shared = await sharedFolderLines(ctx, me);
  // Alone with nothing known: say nothing at all.
  if (withProtocol && team.length === 0 && conflicts.length === 0 && failures.length === 0) return "";
  const warnings = shared.length ? ["Same folder:", ...shared] : [];
  const body = [
    ...warnings,
    ...(team.length ? ["Team:", ...team] : ["Team: no other active agents"]),
    ...(conflicts.length ? ["Open conflicts involving you:", ...conflicts] : []),
    ...(failures.length ? ["Known failures:", ...failures] : []),
  ].slice(0, MAX_LINES);
  return ["[little-brother] team digest", ...body, ...(withProtocol ? PROTOCOL : [])].join("\n");
}

/** Render queued items into hook context and mark them delivered in the same transaction. */
export async function deliverPending(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  actions?: Doc<"inbox">["action"][],
): Promise<string> {
  const items = await queuedItems(ctx, agentId, actions);
  await markDeliveredIds(
    ctx,
    items.map((i) => i._id),
  );
  return renderDigest(items.map((i) => ({ id: i._id, text: i.text })));
}
