import type { IngestEnvelope } from "@lb/core";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import { sha256Hex } from "../convex/hash";
import schema from "../convex/schema";

export const modules = import.meta.glob("../convex/**/*.ts");
export const makeT = () => convexTest(schema, modules);
export type T = ReturnType<typeof makeT>;

/** Every helper member is in one room with this open session, so hooks are recorded. */
export const TEST_SESSION = "test01";

let seq = 0;
export function envelope(hook: string, session: string, extra: Partial<IngestEnvelope> = {}): IngestEnvelope {
  seq += 1;
  return {
    v: 1,
    eventKey: `${session}|${hook}|${seq}`,
    hook,
    session: {
      claudeSessionId: session,
      repo: "lb-demo-shop",
      branch: `${session}/branch`,
      machine: "mbp",
      cwd: "/x",
      lbSession: TEST_SESSION,
    },
    files: [],
    touches: [],
    references: [],
    at: Date.now(),
    ...extra,
  };
}

export async function joinMember(t: T, handle: string): Promise<string> {
  const token = `tok-${handle}`;
  const memberId = await t.mutation(internal.members.join, { handle, tokenHash: await sha256Hex(token) });
  await t.run(async (ctx) => {
    const room =
      (await ctx.db.query("teams").first())?._id ??
      (await ctx.db.insert("teams", { name: "test", inviteCode: "inv", createdAt: 0 }));
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", TEST_SESSION))
      .first();
    if (!session)
      await ctx.db.insert("sessions", {
        teamId: room,
        name: "test",
        code: TEST_SESSION,
        createdBy: memberId,
        createdAt: 0,
      });
    await ctx.db.insert("roomMembers", { teamId: room, memberId, joinedAt: Date.now() });
  });
  return token;
}

export async function hook(t: T, token: string, env: IngestEnvelope) {
  return t.mutation(internal.events.ingest, {
    tokenHash: await sha256Hex(token),
    hook: env.hook,
    envelope: env,
  });
}
