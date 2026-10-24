import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sessionAgents } from "../sessionRows";
import { type LogStep, verdictLogFor } from "./log";
import { roomServerLog, type ServerRow } from "./serverRows";

// The host's room-wide log: the server log and the classifier record of the room's recent sessions merged,
// each line tagged with its session's name so one panel can filter across them.

const SESSIONS = 10;

export type RoomLog = {
  sessions: { id: string; name: string }[];
  server: ServerRow[];
  classifier: (LogStep & { sessionId: string | null })[];
};

export async function roomLog(ctx: QueryCtx, teamId: Id<"teams">): Promise<RoomLog> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .order("desc")
    .take(SESSIONS);
  const agents = [];
  for (const s of sessions) agents.push(...(await sessionAgents(ctx, s._id)));
  const sessionOf = new Map<string, string | null>(agents.map((a) => [a._id, a.sessionId ?? null]));
  const steps = await verdictLogFor(ctx, agents);
  return {
    sessions: sessions.map((s) => ({ id: s._id, name: s.name })),
    server: await roomServerLog(ctx, teamId, agents),
    classifier: steps.map((s) => ({ ...s, sessionId: sessionOf.get(s.agentId) ?? null })),
  };
}
