import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { membership } from "./access";
import { writeLog } from "./serverLog";

export type Admission = "member" | "pending" | "denied";

export async function addMember(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  memberId: Id<"members">,
): Promise<void> {
  if (await membership(ctx, teamId, memberId)) return;
  await ctx.db.insert("roomMembers", { teamId, memberId, joinedAt: Date.now() });
}

export async function latestRequest(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  memberId: Id<"members">,
): Promise<Doc<"joinRequests"> | null> {
  return ctx.db
    .query("joinRequests")
    .withIndex("by_member_team", (q) => q.eq("memberId", memberId).eq("teamId", teamId))
    .order("desc")
    .first();
}

/**
 * Someone with the invite link or a session code wants in. Open rooms (and their owner) let them straight
 * in; otherwise they wait for the owner, like a meeting's waiting room. A denial sticks until the owner
 * admits them from the request list or resets the invite.
 */
export async function requestOrJoin(
  ctx: MutationCtx,
  team: Doc<"teams">,
  member: Doc<"members">,
  via: Doc<"joinRequests">["via"],
  sessionId?: Id<"sessions">,
): Promise<Admission> {
  if (await membership(ctx, team._id, member._id)) return "member";
  const log = { teamId: team._id, memberId: member._id, sessionId };
  if (team.admission === "open" || team.ownerId === member.userId) {
    await addMember(ctx, team._id, member._id);
    await writeLog(ctx, {
      ...log,
      level: "info",
      kind: "joined",
      text: `@${member.handle} joined the room (${via})`,
    });
    return "member";
  }
  const last = await latestRequest(ctx, team._id, member._id);
  if (last?.status === "denied") return "denied";
  if (last?.status === "pending") return "pending";
  await ctx.db.insert("joinRequests", {
    teamId: team._id,
    memberId: member._id,
    via,
    sessionId,
    status: "pending",
    createdAt: Date.now(),
  });
  await writeLog(ctx, {
    ...log,
    level: "info",
    kind: "request",
    text: `@${member.handle} is waiting to join (${via === "claude" ? "from Claude Code" : "invite link"})`,
  });
  return "pending";
}
