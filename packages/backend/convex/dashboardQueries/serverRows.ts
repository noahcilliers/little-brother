import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sessionAgents } from "../sessionRows";

// The host's server log for one session: hook arrivals from `events` merged with what the server decided
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
};

const eventText = (e: Doc<"events">): string => {
  const head = e.tool ? `${e.hook} ${e.tool}` : e.hook;
  const file = e.files[0] ? ` ${e.files[0]}` : "";
  const summary =
    e.summary && e.summary !== e.hook ? ` · ${e.summary.replace(/\s+/g, " ").slice(0, 140)}` : "";
  return `${head}${file}${summary}`;
};

export async function serverLog(ctx: QueryCtx, session: Doc<"sessions">): Promise<ServerRow[]> {
  const handles = new Map<string, string>();
  const handle = async (memberId: Id<"members"> | undefined) => {
    if (!memberId) return "server";
    const known = handles.get(memberId);
    if (known) return known;
    const h = (await ctx.db.get(memberId))?.handle ?? "member";
    handles.set(memberId, h);
    return h;
  };
  const rows: ServerRow[] = [];
  for (const a of await sessionAgents(ctx, session._id)) {
    const events = await ctx.db
      .query("events")
      .withIndex("by_agent_time", (q) => q.eq("agentId", a._id))
      .order("desc")
      .take(EVENTS_PER_AGENT);
    const who = await handle(a.memberId);
    for (const e of events)
      rows.push({ id: e._id, at: e.at, level: "info", kind: `hook · ${a.machine}`, who, text: eventText(e) });
  }
  // Room-wide lines (joins, admissions, outdated connectors) carry no session but matter here too.
  const logs = await ctx.db
    .query("serverLog")
    .withIndex("by_team", (q) => q.eq("teamId", session.teamId))
    .order("desc")
    .take(LOG_ROWS);
  for (const l of logs) {
    if (l.sessionId && l.sessionId !== session._id) continue;
    rows.push({
      id: l._id,
      at: l.at,
      level: l.level,
      kind: l.kind,
      who: await handle(l.memberId),
      text: l.text,
    });
  }
  return rows.sort((a, b) => b.at - a.at).slice(0, LIMIT);
}
