import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sessionAgents } from "../sessionRows";

// The host's server log: hook arrivals from `events` merged with what the server decided
// (`serverLog`: joins, admissions, dropped events, classifier runs), newest first.

const EVENTS_PER_AGENT = 120;
const LOG_ROWS = 300;
const LIMIT = 400;

export type ServerRow = {
  id: string;
  at: number;
  level: Doc<"serverLog">["level"];
  kind: string;
  who: string;
  text: string;
  /** The session the line belongs to; null for room-wide lines (joins, outdated connectors). */
  sessionId: string | null;
};

const eventText = (e: Doc<"events">): string => {
  const head = e.tool ? `${e.hook} ${e.tool}` : e.hook;
  const file = e.files[0] ? ` ${e.files[0]}` : "";
  const summary =
    e.summary && e.summary !== e.hook ? ` · ${e.summary.replace(/\s+/g, " ").slice(0, 140)}` : "";
  return `${head}${file}${summary}`;
};

/** Member handles, looked up once per query. */
function handleCache(ctx: QueryCtx) {
  const handles = new Map<string, string>();
  return async (memberId: Id<"members"> | undefined) => {
    if (!memberId) return "server";
    const known = handles.get(memberId);
    if (known) return known;
    const h = (await ctx.db.get(memberId))?.handle ?? "member";
    handles.set(memberId, h);
    return h;
  };
}

type Handle = ReturnType<typeof handleCache>;

async function hookRows(
  ctx: QueryCtx,
  agents: Doc<"agents">[],
  perAgent: number,
  handle: Handle,
): Promise<ServerRow[]> {
  const rows: ServerRow[] = [];
  for (const a of agents) {
    const events = await ctx.db
      .query("events")
      .withIndex("by_agent_time", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(perAgent);
    const who = await handle(a.memberId);
    for (const e of events)
      rows.push({
        id: e._id,
        at: e.at,
        level: "info",
        kind: `hook · ${a.machine}`,
        who,
        text: eventText(e),
        sessionId: a.sessionId ?? null,
      });
  }
  return rows;
}

/** The room's `serverLog` lines that `keep` accepts, by session id (null = room-wide). */
async function teamRows(
  ctx: QueryCtx,
  teamId: Id<"teams">,
  keep: (sessionId: string | null) => boolean,
  handle: Handle,
): Promise<ServerRow[]> {
  const logs = await ctx.db
    .query("serverLog")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .order("desc")
    .take(LOG_ROWS);
  const rows: ServerRow[] = [];
  for (const l of logs) {
    const sessionId = l.sessionId ?? null;
    if (!keep(sessionId)) continue;
    rows.push({
      id: l._id,
      at: l.at,
      level: l.level,
      kind: l.kind,
      who: await handle(l.memberId),
      text: l.text,
      sessionId,
    });
  }
  return rows;
}

const newestFirst = (rows: ServerRow[]) => rows.sort((a, b) => b.at - a.at).slice(0, LIMIT);

export async function serverLog(ctx: QueryCtx, session: Doc<"sessions">): Promise<ServerRow[]> {
  const handle = handleCache(ctx);
  const hooks = await hookRows(ctx, await sessionAgents(ctx, session._id), EVENTS_PER_AGENT, handle);
  // Room-wide lines (joins, admissions, outdated connectors) carry no session but matter here too.
  const logs = await teamRows(ctx, session.teamId, (s) => s === null || s === session._id, handle);
  return newestFirst([...hooks, ...logs]);
}

/** Every session's hooks and every server line in the room; fewer hooks per agent since there are more agents. */
export async function roomServerLog(
  ctx: QueryCtx,
  teamId: Id<"teams">,
  agents: Doc<"agents">[],
): Promise<ServerRow[]> {
  const handle = handleCache(ctx);
  const perAgent = Math.max(20, Math.floor(EVENTS_PER_AGENT / Math.max(1, agents.length / 4)));
  const hooks = await hookRows(ctx, agents, perAgent, handle);
  const logs = await teamRows(ctx, teamId, () => true, handle);
  return newestFirst([...hooks, ...logs]);
}
