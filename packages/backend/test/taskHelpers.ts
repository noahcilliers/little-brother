import type { IngestEnvelope, Touch } from "@lb/core";
import { vi } from "vitest";
import { envelope, hook, type T } from "./platformHelpers";

export const TOPICS = {
  topics: {
    "db.users": { owner: "noah", files: ["db/schema/users.ts"], consumers: ["src/checkout/**"] },
    "auth.mechanism": { owner: "noah", files: ["src/auth/**"], consumers: ["src/checkout/**"] },
    "api.cors": { owner: "noah", files: ["src/server.ts", "web/vite.config.ts"], consumers: [] },
    "api.cart.shape": { owner: "joshua", files: ["src/checkout/cart.ts"], consumers: [] },
  },
};

export const CLOCK_START = Date.UTC(2026, 9, 24, 9);
let clock = CLOCK_START;
const tick = () => {
  clock += 1000;
  vi.setSystemTime(clock);
};

export async function send(
  t: T,
  token: string,
  hookName: string,
  session: string,
  extra: Partial<IngestEnvelope> = {},
) {
  tick();
  return hook(t, token, envelope(hookName, session, extra));
}

export const edit = (path: string, touches: Touch[], toolUseId: string): Partial<IngestEnvelope> => ({
  tool: "Edit",
  toolUseId,
  files: [path],
  touches: [{ path, op: "write", lines: [1, 5] }, ...touches],
  preview: `${toolUseId} change`,
});

export async function editBoth(t: T, token: string, session: string, e: Partial<IngestEnvelope>) {
  await send(t, token, "PreToolUse", session, e);
  return send(t, token, "PostToolUse", session, e);
}

export const tasksOf = (t: T, session: string) =>
  t.run(async (ctx) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("claudeSessionId", session))
      .first();
    if (!agent) return [];
    return ctx.db
      .query("tasks")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
  });
export const nodeByToolUse = (t: T, toolUseId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("nodes")
      .withIndex("by_tool_use", (q) => q.eq("toolUseId", toolUseId))
      .first(),
  );
export const bySubject = async (t: T, session: string, subject: string) =>
  (await tasksOf(t, session)).find((x) => x.subject === subject);
