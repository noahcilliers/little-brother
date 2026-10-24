import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type GitConflict = { a: string; b: string; files: string[] };
type Klass = Doc<"classifications">;

/** Most recently seen agents first, preferring the verifying member's repo when it is known. */
export async function agentsOnBranch(
  ctx: MutationCtx,
  branch: string,
  repo: string,
): Promise<Doc<"agents">[]> {
  const all = await ctx.db.query("agents").collect();
  const onBranch = all.filter((a) => a.branch === branch).sort((x, y) => y.lastSeenAt - x.lastSeenAt);
  const sameRepo = repo ? onBranch.filter((a) => a.repo === repo) : [];
  return sameRepo.length ? sameRepo : onBranch;
}

/** Live and settled verdicts; git outcomes are labels, so resolved ones count too. */
export async function recentVerdicts(ctx: MutationCtx): Promise<Klass[]> {
  const out: Klass[] = [];
  for (const status of ["open", "resolved"] as const) {
    out.push(
      ...(await ctx.db
        .query("classifications")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(500)),
    );
  }
  return out;
}

const spans = (c: Klass, as: Set<Id<"agents">>, bs: Set<Id<"agents">>) =>
  c.agentIds.some((id) => as.has(id)) && c.agentIds.some((id) => bs.has(id));

async function filesOf(ctx: MutationCtx, c: Klass): Promise<Set<string>> {
  const nodes = await Promise.all([
    ctx.db.get(c.nodeId),
    c.againstNodeId ? ctx.db.get(c.againstNodeId) : null,
  ]);
  return new Set(nodes.flatMap((n) => n?.files ?? []));
}

/** Verdicts between agents on the two branches that are about any of the conflicted files. */
export async function verdictsCovering(
  ctx: MutationCtx,
  verdicts: Klass[],
  as: Doc<"agents">[],
  bs: Doc<"agents">[],
  files: string[],
): Promise<Klass[]> {
  const aIds = new Set(as.map((a) => a._id));
  const bIds = new Set(bs.map((b) => b._id));
  const out: Klass[] = [];
  for (const c of verdicts) {
    if (!spans(c, aIds, bIds)) continue;
    const covered = await filesOf(ctx, c);
    if (files.length === 0 || files.some((f) => covered.has(f))) out.push(c);
  }
  return out;
}

/** The agent's latest action on any of the files, else its latest node of any kind. */
async function anchorNode(ctx: MutationCtx, agentId: Id<"agents">, files: string[]) {
  const recent = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(200);
  return (
    recent.find((n) => n.kind === "action" && n.files.some((f) => files.includes(f))) ?? recent[0] ?? null
  );
}

async function handleOf(ctx: MutationCtx, agent: Doc<"agents">): Promise<string> {
  const member = await ctx.db.get(agent.memberId);
  return member ? `@${member.handle}` : "another agent";
}

/**
 * A git conflict nobody flagged live becomes a first-class serialize verdict, labelled `missed` so the
 * classifier's recall gap is visible and trainable.
 */
export async function insertMissed(
  ctx: MutationCtx,
  conflict: GitConflict,
  a: Doc<"agents">,
  b: Doc<"agents">,
  eventId: Id<"events">,
): Promise<Id<"classifications"> | null> {
  const node = await anchorNode(ctx, a._id, conflict.files);
  if (!node) return null;
  const against = await anchorNode(ctx, b._id, conflict.files);
  const files = conflict.files.length ? conflict.files.join(", ") : "the same lines";
  const reason = `[little-brother] conflict · git merge-tree: ${conflict.a} and ${conflict.b} both change ${files} (found by lb verify, missed live)`;
  const now = Date.now();
  const id = await ctx.db.insert("classifications", {
    eventId,
    nodeId: node._id,
    ...(against ? { againstNodeId: against._id } : {}),
    type: "conflict",
    relation: "textual_conflict",
    direction: "none",
    action: "serialize",
    agentIds: [a._id, b._id],
    reason,
    evidence: [`git merge-tree ${conflict.a} ${conflict.b}`, ...conflict.files.map((f) => `conflict: ${f}`)],
    confidence: 0.99,
    retrievalScore: 1,
    source: "rule",
    status: "open",
    outcome: "merge_conflict",
    gitStatus: "missed",
    latencyMs: 0,
    at: now,
  });
  for (const [me, them] of [
    [a, b],
    [b, a],
  ] as const) {
    await ctx.db.insert("inbox", {
      agentId: me._id,
      classificationId: id,
      text: `${reason.replace(/^\[little-brother\]\s*/, "")} — coordinate with ${await handleOf(ctx, them)}: one of you lands first, the other rebases on it.`,
      action: "serialize",
      state: "queued",
      attempts: 0,
      at: now,
    });
  }
  return id;
}
