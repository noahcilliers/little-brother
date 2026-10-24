import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { EXTRA_GOALS, EXTRA_TASKS, INBOX } from "./devSeedExtra";
import { writeLoose, writeOrdering, writeTopicMap, writeVerdict, writeVerify } from "./devSeedRows";
import { CATCHES, DECISION, EXTRA_HANDLES, GOALS, HANDLES, LESSON, TASKS, VERIFY_AT } from "./devSeedStory";
import { startStory, TAG, writeEvent, writeNode, writeTask } from "./devSeedWrite";

// Dev only: inserts the dashboard prototype's story with timestamps relative to now, tagged so `clear` removes it.
// Run from packages/backend: `npx convex run devSeed:story` (or '{"at": 16}' to stop the story mid-way,
// '{"agents": 6}' to add three more teammates).

export const story = internalMutation({
  args: { at: v.optional(v.number()), agents: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const extra = Math.max(0, Math.min(EXTRA_HANDLES.length, (args.agents ?? 3) - HANDLES.length));
    const handles = [...HANDLES, ...EXTRA_HANDLES.slice(0, extra)];
    const s = await startStory(ctx, args.at ?? 24, handles);
    await writeTopicMap(s);
    const present = (t: { a: (typeof handles)[number] }) => handles.includes(t.a);

    const goals: Id<"nodes">[] = [];
    for (const g of [...GOALS, ...EXTRA_GOALS]) {
      if (!present(g)) {
        goals.push(goals[0] as Id<"nodes">);
        continue;
      }
      goals.push(await writeNode(s, g.a, g.t, { kind: "intent", text: `PLAN ${g.topic} ${g.prompt}` }));
      if (!s.seen(g.t)) continue;
      await ctx.db.patch(s.agent[g.a], { intentId: goals[goals.length - 1] });
      const payload = { envelope: { prompt: g.prompt }, output: null };
      await writeEvent(s, g.a, g.t, "UserPromptSubmit", { summary: g.prompt, payload });
    }

    const firstAct = new Map<string, Id<"nodes">>();
    for (const k of [...TASKS, ...EXTRA_TASKS]) {
      if (!s.seen(k.t0) || !present(k)) continue;
      const [first] = await writeTask(s, k, goals[k.goal]);
      if (first) firstAct.set(k.key, first);
    }

    const lesson = s.seen(LESSON.t)
      ? await writeNode(s, LESSON.a, LESSON.t, {
          kind: "knowledge",
          text: LESSON.text,
          parentId: goals[LESSON.goal],
        })
      : undefined;
    if (s.seen(DECISION.t)) {
      const parentId = firstAct.get(DECISION.from);
      await writeNode(s, DECISION.a, DECISION.t, { kind: "knowledge", text: DECISION.text, parentId });
    }

    const klass: (Id<"classifications"> | undefined)[] = [];
    for (const c of CATCHES) {
      const nodeId = firstAct.get(c.from);
      const againstNodeId = c.against === "lesson" ? lesson : firstAct.get(c.against);
      const resolved = s.seen(c.resolvedAt);
      const id =
        s.seen(c.t) && nodeId && againstNodeId
          ? await writeVerdict(s, c.t, {
              nodeId,
              againstNodeId,
              type: c.type,
              relation: c.relation,
              action: c.action,
              agentIds: Object.values(s.agent),
              reason: c.reason,
              status: resolved ? "resolved" : "open",
              comparison: c.comparison,
            })
          : undefined;
      klass.push(id);
      if (id && resolved && c.resolvedAt !== undefined) {
        const payload = { classificationId: id };
        await writeEvent(s, "noah", c.resolvedAt, "Resolve", {
          source: "human",
          summary: DECISION.text,
          payload,
        });
      }
    }
    await writeLoose(s);
    await writeOrdering(s, firstAct);
    for (const i of INBOX) {
      const classificationId = klass[i.catch];
      if (!s.seen(i.t) || !classificationId) continue;
      await ctx.db.insert("inbox", {
        agentId: s.agent[i.a],
        classificationId,
        text: i.text,
        action: i.action,
        state: "delivered",
        attempts: 1,
        at: s.T(i.t),
      });
    }

    if (s.seen(VERIFY_AT)) await writeVerify(s, VERIFY_AT);
    return { at: s.at, tasks: firstAct.size };
  },
});

export const clear = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agents = (await ctx.db.query("agents").order("desc").take(500)).filter((a) =>
      a.claudeSessionId.startsWith(`${TAG}-`),
    );
    let rows = 0;
    for (const a of agents) {
      const nodes = await ctx.db
        .query("nodes")
        .withIndex("by_agent", (q) => q.eq("agentId", a._id))
        .take(500);
      for (const n of nodes) {
        const verdicts = await ctx.db
          .query("classifications")
          .withIndex("by_node", (q) => q.eq("nodeId", n._id))
          .take(50);
        for (const c of verdicts) {
          const items = await ctx.db
            .query("inbox")
            .withIndex("by_classification", (q) => q.eq("classificationId", c._id))
            .take(50);
          for (const r of [...items, c]) await ctx.db.delete(r._id);
          rows += items.length + 1;
        }
      }
      const owned = [
        ...nodes,
        ...(await ctx.db
          .query("events")
          .withIndex("by_agent_time", (q) => q.eq("agentId", a._id))
          .take(500)),
        ...(await ctx.db
          .query("tasks")
          .withIndex("by_agent", (q) => q.eq("agentId", a._id))
          .take(500)),
      ];
      for (const r of owned) await ctx.db.delete(r._id);
      await ctx.db.delete(a._id);
      rows += owned.length + 1;
    }
    for (const row of await ctx.db.query("settings").take(200)) {
      if (row.value?.[TAG] === true) await ctx.db.delete(row._id);
    }
    for (const m of await ctx.db.query("members").take(200)) {
      if (m.tokenHash.startsWith(`${TAG}:`)) await ctx.db.delete(m._id);
    }
    return { agents: agents.length, rows };
  },
});
