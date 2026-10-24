import { v } from "convex/values";
import { z } from "zod";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { resolveAgent } from "./agents";
import { memberByTokenHash } from "./auth";
import {
  agentsOnBranch,
  type GitConflict,
  insertMissed,
  recentVerdicts,
  verdictsCovering,
} from "./gitVerify";

export const VerifyBody = z.object({
  branches: z.array(z.string()).min(1),
  passed: z.boolean(),
  outputTail: z.string().max(4000).default(""),
  conflicts: z
    .array(z.object({ a: z.string(), b: z.string(), files: z.array(z.string()).default([]) }))
    .default([]),
  // Stop-hook merge-tree runs: no tests ran, so they may only add conflict evidence, never clean labels.
  background: z.boolean().optional(),
});
export type VerifyBody = z.infer<typeof VerifyBody>;

type Outcome = "merge_conflict" | "post_merge_test_failure" | "clean_merge";

/** `lb verify` runs outside any Claude session, so it logs under the member's latest agent or a synthetic one. */
async function verifyAgent(ctx: MutationCtx, member: Doc<"members">): Promise<Id<"agents">> {
  const agent = await resolveAgent(ctx, member._id, "");
  if (agent) return agent._id;
  return ctx.db.insert("agents", {
    memberId: member._id,
    claudeSessionId: `verify:${member.handle}`,
    machine: "verify",
    repo: "",
    branch: "",
    status: "offline",
    lastSeenAt: Date.now(),
  });
}

function outcomeFor(pairBranches: Set<string>, body: VerifyBody): Outcome {
  const conflicted = body.conflicts.some((c) => pairBranches.has(c.a) && pairBranches.has(c.b));
  if (conflicted) return "merge_conflict";
  return body.passed ? "clean_merge" : "post_merge_test_failure";
}

const pairKey = (a: string, b: string) => [a, b].sort().join("\u0000");

/** Git-found conflicts confirm the verdicts that predicted them, or become new `missed` verdicts. */
async function labelConflicts(
  ctx: MutationCtx,
  conflicts: GitConflict[],
  repo: string,
  eventId: Id<"events">,
): Promise<{ confirmed: number; missed: number }> {
  const verdicts = await recentVerdicts(ctx);
  let confirmed = 0;
  let missed = 0;
  for (const conflict of conflicts) {
    const as = await agentsOnBranch(ctx, conflict.a, repo);
    const bs = await agentsOnBranch(ctx, conflict.b, repo);
    const [a] = as;
    const [b] = bs;
    if (!a || !b) continue;
    const covering = await verdictsCovering(ctx, verdicts, as, bs, conflict.files);
    for (const c of covering) {
      // A verdict we inserted as missed stays missed: re-finding the same conflict is not a live catch.
      if (c.gitStatus === "missed") continue;
      await ctx.db.patch(c._id, { gitStatus: "confirmed", outcome: "merge_conflict" });
      confirmed += 1;
    }
    if (covering.length === 0 && (await insertMissed(ctx, conflict, a, b, eventId))) missed += 1;
  }
  return { confirmed, missed };
}

/** Every merged pair without a conflict, when the merged tests passed, is evidence the pair was independent. */
async function labelClean(ctx: MutationCtx, body: VerifyBody, repo: string): Promise<number> {
  const conflicted = new Set(body.conflicts.map((c) => pairKey(c.a, c.b)));
  const verdicts = await recentVerdicts(ctx);
  let n = 0;
  for (let i = 0; i < body.branches.length; i++) {
    for (let j = i + 1; j < body.branches.length; j++) {
      const a = body.branches[i] ?? "";
      const b = body.branches[j] ?? "";
      if (conflicted.has(pairKey(a, b))) continue;
      const as = await agentsOnBranch(ctx, a, repo);
      const bs = await agentsOnBranch(ctx, b, repo);
      for (const c of await verdictsCovering(ctx, verdicts, as, bs, [])) {
        if (c.gitStatus && c.gitStatus !== "clean") continue;
        await ctx.db.patch(c._id, { gitStatus: "clean" });
        n += 1;
      }
    }
  }
  return n;
}

/** Step 7 of the classifier: join real merge/test outcomes onto open verdicts between the merged branches. */
export const record = internalMutation({
  args: { tokenHash: v.string(), body: v.any() },
  handler: async (ctx, args): Promise<{ status: 200 | 401; text: string }> => {
    const member = await memberByTokenHash(ctx, args.tokenHash);
    if (!member) return { status: 401, text: "unauthorized" };
    const body = VerifyBody.parse(args.body);
    const merged = new Set(body.branches);
    const open = await ctx.db
      .query("classifications")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(500);
    const counts: Record<Outcome, number> = { merge_conflict: 0, post_merge_test_failure: 0, clean_merge: 0 };
    for (const c of open) {
      const agents = await Promise.all(c.agentIds.map((id) => ctx.db.get(id)));
      const branches = new Set(agents.flatMap((a) => (a ? [a.branch] : [])));
      if (branches.size < 2 || ![...branches].every((b) => merged.has(b))) continue;
      const outcome = outcomeFor(branches, body);
      if (body.background && outcome !== "merge_conflict") continue;
      await ctx.db.patch(c._id, { outcome });
      counts[outcome] += 1;
    }
    const agentId = await verifyAgent(ctx, member);
    const repo = (await ctx.db.get(agentId))?.repo ?? "";
    const now = Date.now();
    const kind = body.background ? "background merge-tree" : "verify";
    const summary = `${kind} ${body.branches.join(" + ")}: ${body.background ? "no tests run" : body.passed ? "tests passed" : "tests FAILED"}, ${body.conflicts.length} merge conflict(s)`;
    const eventId = await ctx.db.insert("events", {
      agentId,
      eventKey: `verify:${member._id}:${now}`,
      source: "verify",
      hook: "verify",
      files: [...new Set(body.conflicts.flatMap((c) => c.files))],
      summary,
      payload: body,
      at: now,
    });
    const git = await labelConflicts(ctx, body.conflicts, repo, eventId);
    const clean = !body.background && body.passed ? await labelClean(ctx, body, repo) : 0;
    const joined = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`);
    const labels = `git: ${git.confirmed} confirmed, ${git.missed} missed, ${clean} clean`;
    return { status: 200, text: `${summary}. Outcomes joined: ${joined.join(", ") || "none"}. ${labels}` };
  },
});
