import { query } from "./_generated/server";
import { viewerMember } from "./access";

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const AGENT_SCAN = 10;
const EVENT_SCAN = 300;

/** /start checklist: which of the signed-in member's first hook events have arrived. */
export const progress = query({
  args: {},
  handler: async (ctx) => {
    const done = { sessionStart: false, prompt: false, edit: false };
    const member = await viewerMember(ctx);
    if (!member) return { ...done, agents: 0 };
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(AGENT_SCAN);
    for (const agent of agents) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_agent_time", (q) => q.eq("agentId", agent._id))
        .take(EVENT_SCAN);
      for (const e of events) {
        if (e.hook === "SessionStart") done.sessionStart = true;
        else if (e.hook === "UserPromptSubmit") done.prompt = true;
        else if (e.tool && EDIT_TOOLS.has(e.tool)) done.edit = true;
      }
      if (done.sessionStart && done.prompt && done.edit) break;
    }
    return { ...done, agents: agents.length };
  },
});
