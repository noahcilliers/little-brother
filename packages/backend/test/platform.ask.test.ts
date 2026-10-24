import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { sha256Hex } from "../convex/hash";
import { envelope, hook, joinMember, makeT, type T } from "./platformHelpers";

const QUESTION = [
  { question: "Where should I build?", options: [{ label: "New dir" }, { label: "This repo" }] },
];

async function setup(t: T, handle: string, session: string) {
  const token = await joinMember(t, handle);
  await hook(t, token, envelope("SessionStart", session));
  const tokenHash = await sha256Hex(token);
  const { memberId, sessionId } = await t.run(async (ctx) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("claudeSessionId", session))
      .first();
    if (!agent?.sessionId) throw new Error("agent missing");
    return { memberId: agent.memberId, sessionId: agent.sessionId };
  });
  const userId: Id<"users"> = await t.run((ctx) =>
    ctx.db.insert("users", { name: handle, githubLogin: handle }),
  );
  await t.run((ctx) => ctx.db.patch(memberId, { userId }));
  const viewer = t.withIdentity({ subject: `${userId}|s-${handle}` });
  return { tokenHash, sessionId, viewer };
}

describe("questions answered on the dashboard", () => {
  test("only routed while the developer has the session open; the answer reaches the connector", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    const ash = await setup(t, "ash", "a1");
    const ask = { tokenHash: ash.tokenHash, claudeSessionId: "a1", questions: QUESTION };
    expect(await t.mutation(internal.ask.create, ask)).toBeNull();

    await ash.viewer.mutation(api.ask.ping, { sessionId: ash.sessionId });
    const id = await t.mutation(internal.ask.create, ask);
    expect(id).not.toBeNull();
    const [shown] = await ash.viewer.query(api.ask.pending, { sessionId: ash.sessionId });
    expect(shown?.questions[0]?.question).toBe("Where should I build?");

    const noah = await setup(t, "noah", "n1");
    await expect(
      noah.viewer.mutation(api.ask.answer, {
        id: shown?.id ?? ("" as never),
        answers: [{ question: "Where should I build?", selected: ["This repo"] }],
      }),
    ).rejects.toThrow(/Only you/);

    await ash.viewer.mutation(api.ask.answer, {
      id: shown?.id ?? ("" as never),
      answers: [{ question: "Where should I build?", selected: ["New dir"] }],
    });
    const status = await t.query(internal.ask.status, { tokenHash: ash.tokenHash, id: id ?? "" });
    expect(status).toMatchObject({ status: "answered", answers: [{ selected: ["New dir"] }] });
    expect(await ash.viewer.query(api.ask.pending, { sessionId: ash.sessionId })).toEqual([]);
  });
});
