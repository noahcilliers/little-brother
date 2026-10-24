import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { viewerMember, viewSession } from "./access";
import { agentBySession } from "./agents";
import { askAnswer, askedQuestion } from "./schemaAsk";
import { writeLog } from "./serverLog";
import { memberByTokenHash } from "./tokenAuth";

// AskUserQuestion, answered on the website: the connector's `lb ask` hook posts the question, waits for an
// answer, and hands it back to Claude as the denial reason. The terminal prompt is the fallback.

const PRESENCE_MS = 90_000;
const PENDING_SCAN = 20;

/** The dashboard pings while a session page is open, so questions only go where someone is looking. */
export const ping = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    const member = await viewerMember(ctx);
    if (!sessionId || !member || !(await viewSession(ctx, sessionId))) return null;
    const row = await ctx.db
      .query("presence")
      .withIndex("by_member_session", (q) => q.eq("memberId", member._id).eq("sessionId", sessionId))
      .first();
    if (row) await ctx.db.patch(row._id, { at: Date.now() });
    else await ctx.db.insert("presence", { memberId: member._id, sessionId, at: Date.now() });
    return null;
  },
});

/** From `lb ask`: null means "ask in the terminal" (not joined, or nobody has the session open). */
export const create = internalMutation({
  args: {
    tokenHash: v.string(),
    claudeSessionId: v.string(),
    toolUseId: v.optional(v.string()),
    questions: v.array(askedQuestion),
  },
  handler: async (ctx, a) => {
    const member = await memberByTokenHash(ctx, a.tokenHash);
    const agent = member ? await agentBySession(ctx, a.claudeSessionId) : null;
    const sessionId = agent?.sessionId;
    const teamId = agent?.teamId;
    if (!member || !agent || agent.memberId !== member._id || !sessionId || !teamId) return null;
    const seen = await ctx.db
      .query("presence")
      .withIndex("by_member_session", (q) => q.eq("memberId", member._id).eq("sessionId", sessionId))
      .first();
    if (!seen || Date.now() - seen.at > PRESENCE_MS) return null;
    const id = await ctx.db.insert("questions", {
      agentId: agent._id,
      memberId: member._id,
      sessionId,
      toolUseId: a.toolUseId,
      questions: a.questions,
      status: "pending",
      at: Date.now(),
    });
    await writeLog(ctx, {
      teamId,
      sessionId,
      memberId: member._id,
      level: "info",
      kind: "question",
      text: `@${member.handle}'s agent asked: ${a.questions
        .map((q) => q.question)
        .join(" / ")
        .slice(0, 300)}`,
    });
    return id;
  },
});

export const status = internalQuery({
  args: { tokenHash: v.string(), id: v.string() },
  handler: async (ctx, { tokenHash, id }) => {
    const member = await memberByTokenHash(ctx, tokenHash);
    const qid = ctx.db.normalizeId("questions", id);
    const q = qid ? await ctx.db.get(qid) : null;
    if (!member || !q || q.memberId !== member._id) return null;
    return { status: q.status, answers: q.answers ?? [] };
  },
});

/** The connector gave up waiting and the terminal will ask instead; the popup must not linger. */
export const expire = internalMutation({
  args: { tokenHash: v.string(), id: v.string() },
  handler: async (ctx, { tokenHash, id }) => {
    const member = await memberByTokenHash(ctx, tokenHash);
    const qid = ctx.db.normalizeId("questions", id);
    const q = qid ? await ctx.db.get(qid) : null;
    if (member && q && q.memberId === member._id && q.status === "pending")
      await ctx.db.patch(q._id, { status: "expired" });
    return null;
  },
});

/** The viewer's own agents' unanswered questions in this session (only the asker's developer answers). */
export const pending = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
    const member = await viewerMember(ctx);
    if (!sessionId || !member) return [];
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_session_status", (q) => q.eq("sessionId", sessionId).eq("status", "pending"))
      .take(PENDING_SCAN);
    const out = [];
    for (const r of rows) {
      if (r.memberId !== member._id) continue;
      const agent = await ctx.db.get(r.agentId);
      out.push({ id: r._id, at: r.at, branch: agent?.branch ?? "", questions: r.questions });
    }
    return out;
  },
});

export const answer = mutation({
  args: { id: v.id("questions"), answers: v.array(askAnswer) },
  handler: async (ctx, { id, answers }) => {
    const member = await viewerMember(ctx);
    const q = await ctx.db.get(id);
    if (!member || !q || q.memberId !== member._id) throw new ConvexError("Only you can answer your agent.");
    if (q.status !== "pending") throw new ConvexError("This question was already answered or timed out.");
    await ctx.db.patch(id, { status: "answered", answers, answeredAt: Date.now() });
    return null;
  },
});
