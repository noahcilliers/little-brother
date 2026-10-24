import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { membership, openMode } from "./access";

const SESSIONS_PER_ROOM = 50;
const AGENTS_PER_SESSION = 50;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Six characters without look-alikes (0/o, 1/l/i), so a code read aloud or retyped still works. */
export function sessionCode(): string {
  const raw = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(raw, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export async function freeCode(ctx: QueryCtx): Promise<string> {
  for (;;) {
    const code = sessionCode();
    const taken = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!taken) return code;
  }
}

export async function sessionAgents(ctx: QueryCtx, sessionId: Id<"sessions">): Promise<Doc<"agents">[]> {
  return ctx.db
    .query("agents")
    .withIndex("by_lb_session", (q) => q.eq("sessionId", sessionId))
    .order("desc")
    .take(AGENTS_PER_SESSION);
}

/** A room's sessions with who has joined each and how many Claude sessions are live in it. */
export async function roomSessions(ctx: QueryCtx, teamId: Id<"teams">) {
  const rows = await ctx.db
    .query("sessions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .order("desc")
    .take(SESSIONS_PER_ROOM);
  const out = [];
  for (const s of rows) {
    const agents = await sessionAgents(ctx, s._id);
    const handles = new Set<string>();
    for (const a of agents) {
      const m = await ctx.db.get(a.memberId);
      if (m) handles.add(m.handle);
    }
    out.push({
      id: s._id,
      name: s.name,
      code: s.code,
      createdAt: s.createdAt,
      endedAt: s.endedAt ?? null,
      people: [...handles],
      claudeSessions: agents.length,
      live: agents.filter((a) => a.status !== "offline").length,
      lastActive: agents[0]?.lastSeenAt ?? null,
    });
  }
  return out;
}

/**
 * The open session a connector's code names, if this member's room has it. In local open mode an unknown
 * code creates the session, so e2e runs need no website.
 */
export async function sessionForCode(
  ctx: MutationCtx,
  member: Doc<"members">,
  code: string | undefined,
): Promise<Doc<"sessions"> | null> {
  if (!code) return null;
  const found = await ctx.db
    .query("sessions")
    .withIndex("by_code", (q) => q.eq("code", code.toLowerCase()))
    .first();
  if (found) {
    if (found.endedAt) return null;
    if (openMode() || (await membership(ctx, found.teamId, member._id))) return found;
    return null;
  }
  if (!openMode()) return null;
  const team =
    (await ctx.db.query("teams").first()) ??
    (await ctx.db.get(
      await ctx.db.insert("teams", { name: "local", inviteCode: "local", createdAt: Date.now() }),
    ));
  if (!team) return null;
  const id = await ctx.db.insert("sessions", {
    teamId: team._id,
    name: code,
    code: code.toLowerCase(),
    createdBy: member._id,
    createdAt: Date.now(),
  });
  return ctx.db.get(id);
}
