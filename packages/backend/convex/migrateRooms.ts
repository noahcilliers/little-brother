import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { freeCode } from "./sessionRows";

// One-off: the single-team deployment becomes a room. Everyone already on it joins the room, and every agent
// recorded before sessions existed lands in one "Earlier work" session so the old board stays reachable.

const SCAN = 2000;

async function joinAll(ctx: MutationCtx, team: Doc<"teams">): Promise<void> {
  const members = (await ctx.db.query("members").take(SCAN)).filter((m) => !m.revoked && m.userId);
  for (const m of members) {
    const have = await ctx.db
      .query("roomMembers")
      .withIndex("by_member", (q) => q.eq("memberId", m._id).eq("teamId", team._id))
      .first();
    if (!have)
      await ctx.db.insert("roomMembers", { teamId: team._id, memberId: m._id, joinedAt: team.createdAt });
  }
}

export const backfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const team = await ctx.db.query("teams").first();
    if (!team) return { moved: 0 };
    await joinAll(ctx, team);
    const loose = (await ctx.db.query("agents").take(SCAN)).filter((a) => !a.sessionId);
    if (loose.length === 0) return { moved: 0 };
    const owner = (await ctx.db.query("members").take(SCAN)).find((m) => m.userId === team.ownerId);
    const createdBy = owner?._id ?? loose[0]?.memberId;
    if (!createdBy) return { moved: 0 };
    const sessionId = await ctx.db.insert("sessions", {
      teamId: team._id,
      name: "Earlier work",
      code: await freeCode(ctx),
      createdBy,
      createdAt: Math.min(...loose.map((a) => a._creationTime)),
      endedAt: Date.now(),
    });
    for (const a of loose) await ctx.db.patch(a._id, { teamId: team._id, sessionId });
    return { moved: loose.length, sessionId };
  },
});

/** Dev seeds write into this session (code `demo00`) in the first room, which every signed-in member joins. */
export async function demoSession(ctx: MutationCtx): Promise<Doc<"sessions">> {
  const have = await ctx.db
    .query("sessions")
    .withIndex("by_code", (q) => q.eq("code", "demo00"))
    .first();
  if (have) return have;
  const teamId =
    (await ctx.db.query("teams").first())?._id ??
    (await ctx.db.insert("teams", { name: "Demo", inviteCode: "demo", createdAt: Date.now() }));
  const team = await ctx.db.get(teamId);
  if (team) await joinAll(ctx, team);
  const anyone = (await ctx.db.query("members").first())?._id;
  const createdBy =
    anyone ?? (await ctx.db.insert("members", { name: "demo", handle: "demo", revoked: false }));
  const id = await ctx.db.insert("sessions", {
    teamId,
    name: "Demo · lb-demo-shop",
    code: "demo00",
    createdBy,
    createdAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("demo session insert vanished");
  return created;
}
