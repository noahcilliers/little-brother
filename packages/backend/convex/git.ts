import type { GitOp } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type Landed = NonNullable<Doc<"nodes">["landed"]>;

const RECENT_MS = 2 * 60 * 60_000;
const SCAN = 300;
const RANK: Record<Landed, number> = { committed: 1, pushed: 2, merged: 3 };
export const RELEASE_MARK = "you can build on it now";

export const isDefaultBranch = (b: string | undefined): boolean => b === "main" || b === "master";

const branchOf = (target: string | undefined): string | undefined =>
  target?.includes("/") ? target.slice(target.indexOf("/") + 1) : target;

/** How far a successful op moved the agent's work: a push to main or a merge on main counts as merged. */
export function landingOf(git: GitOp): Landed | null {
  if (!git.ok) return null;
  if (git.op === "commit") return "committed";
  if (git.op === "push") return isDefaultBranch(branchOf(git.target)) ? "merged" : "pushed";
  if (git.op === "merge") return isDefaultBranch(git.branch) ? "merged" : null;
  return null;
}

/** The agent's live work: the current trajectory plus anything from the last two hours. */
async function workNodes(ctx: MutationCtx, agent: Doc<"agents">, now: number): Promise<Doc<"nodes">[]> {
  const recent = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
    .order("desc")
    .take(SCAN);
  return recent.filter(
    (n) =>
      n.kind === "action" &&
      n.outcome !== "failed" &&
      n.outcome !== "superseded" &&
      (n.parentId === agent.intentId || n.at >= now - RECENT_MS),
  );
}

/** Raises `landed` on the nodes this op carried; never lowers it. Returns the nodes that moved. */
async function markLanded(
  ctx: MutationCtx,
  nodes: Doc<"nodes">[],
  git: GitOp,
  level: Landed,
): Promise<Doc<"nodes">[]> {
  const committed = new Set(git.files);
  const moved: Doc<"nodes">[] = [];
  for (const n of nodes) {
    const current = n.landed ? RANK[n.landed] : 0;
    if (current >= RANK[level]) continue;
    // Pushes carry earlier commits; files only name what this command itself committed.
    const carried = (current > 0 && level !== "committed") || n.files.some((f) => committed.has(f));
    if (!carried) continue;
    await ctx.db.patch(n._id, { landed: level });
    moved.push({ ...n, landed: level });
  }
  return moved;
}

async function handleOf(ctx: MutationCtx, agent: Doc<"agents">): Promise<string> {
  const member = await ctx.db.get(agent.memberId);
  return member ? `@${member.handle}` : "a teammate";
}

function releaseText(handle: string, git: GitOp, level: Landed, files: string[], branch: string): string {
  const sha7 = (git.sha ?? "").slice(0, 7) || "unknown";
  const what = files.length ? files.slice(0, 3).join(", ") : "its changes";
  if (level === "merged")
    return `${handle} merged ${what} into ${branch} (${sha7}); ${RELEASE_MARK} — pull ${branch}.`;
  return `${handle} pushed ${what} (${sha7}); ${RELEASE_MARK} — pull ${branch} or wait for merge.`;
}

/** Open serialize/block verdicts whose held (winning) side is one of these nodes. */
async function heldBy(ctx: MutationCtx, agentId: Id<"agents">, nodeIds: Id<"nodes">[]) {
  const out = new Map<Id<"classifications">, Doc<"classifications">>();
  const urgent = (c: Doc<"classifications">) =>
    c.status === "open" && (c.action === "serialize" || c.action === "block");
  for (const id of nodeIds) {
    const asOlder = await ctx.db
      .query("classifications")
      .withIndex("by_against", (q) => q.eq("againstNodeId", id))
      .take(50);
    for (const c of asOlder)
      if (urgent(c) && (!c.winnerAgentId || c.winnerAgentId === agentId)) out.set(c._id, c);
    const asNewer = await ctx.db
      .query("classifications")
      .withIndex("by_node", (q) => q.eq("nodeId", id))
      .take(50);
    for (const c of asNewer) if (urgent(c) && c.winnerAgentId === agentId) out.set(c._id, c);
  }
  return [...out.values()];
}

async function release(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  git: GitOp,
  level: Landed,
  moved: Doc<"nodes">[],
) {
  const byId = new Map(moved.map((n) => [n._id as string, n]));
  // Where the waiting agent can pull the work from: the pushed branch, or the branch merged into.
  const branch = git.op === "merge" ? (git.branch ?? "main") : (branchOf(git.target) ?? agent.branch);
  const handle = await handleOf(ctx, agent);
  const now = Date.now();
  let released = 0;
  for (const c of await heldBy(ctx, agent._id, [...byId.keys()] as Id<"nodes">[])) {
    const held = byId.get(c.againstNodeId ?? "") ?? byId.get(c.nodeId);
    await ctx.db.patch(c._id, {
      status: "resolved",
      resolution: `landed: ${git.op} ${(git.sha ?? "").slice(0, 7)}`.trim(),
    });
    released += 1;
    const text = releaseText(handle, git, level, held?.files ?? [], branch);
    const prior = await ctx.db
      .query("inbox")
      .withIndex("by_classification", (q) => q.eq("classificationId", c._id))
      .collect();
    for (const waiting of c.agentIds) {
      if (waiting === agent._id) continue;
      if (prior.some((i) => i.agentId === waiting && i.text.includes(RELEASE_MARK))) continue;
      await ctx.db.insert("inbox", {
        agentId: waiting,
        classificationId: c._id,
        text,
        action: "warn",
        state: "queued",
        attempts: 0,
        at: now,
      });
    }
  }
  return released;
}

/**
 * PostToolUse of a git command: record it on the agent, mark what landed, and once work is pushed or merged
 * release the claims it held so waiting agents hear they can build on it.
 */
export async function applyGitOp(ctx: MutationCtx, agent: Doc<"agents">, git: GitOp): Promise<string> {
  const now = Date.now();
  await ctx.db.patch(agent._id, {
    git: { op: git.op, ok: git.ok, sha: git.sha, target: git.target, at: now },
  });
  const level = landingOf(git);
  if (!level) return "";
  const moved = await markLanded(ctx, await workNodes(ctx, agent, now), git, level);
  if (level === "committed") return moved.length ? ` · ${moved.length} committed` : "";
  const released = await release(ctx, agent, git, level, moved);
  return ` · ${moved.length} ${level}${released ? `, ${released} claim(s) released` : ""}`;
}
