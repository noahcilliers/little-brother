import { expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { sha256Hex } from "../convex/hash";
import envs from "./zz-envs.json";
import { joinMember, makeT } from "./platformHelpers";

test("scenario sim", async () => {
  vi.useFakeTimers();
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  const t = makeT();
  for (const h of ["noah", "joshua", "ash", "maya", "leo", "priya"]) await joinMember(t, h);
  const sessions: Record<string, string> = {};
  const log: string[] = [];
  for (const raw of envs as any[]) {
    vi.setSystemTime(raw.at ?? raw.env.at);
    const tokenHash = await sha256Hex(`tok-${raw.as}`);
    if (raw.mcp) {
      const r = await t.mutation(internal.mcp.call, { tokenHash, tool: raw.mcp, claudeSessionId: sessions[raw.as], args: raw.args });
      log.push(`${raw.step}: MCP ${r.text}`);
    } else {
      sessions[raw.as] = raw.env.session.claudeSessionId;
      const r = await t.mutation(internal.events.ingest, { tokenHash, hook: raw.env.hook, envelope: raw.env });
      const o = JSON.stringify(r.output ?? null);
      if (o !== "null") log.push(`${raw.step}: ${o.slice(0, 260)}`);
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  }
  const dump = await t.run(async (ctx) => {
    const members = new Map((await ctx.db.query("members").collect()).map((m) => [m._id, m.handle]));
    const agents = new Map((await ctx.db.query("agents").collect()).map((a) => [a._id, members.get(a.memberId)]));
    const nodes = new Map((await ctx.db.query("nodes").collect()).map((n) => [n._id, n]));
    const cls = (await ctx.db.query("classifications").collect()).map((c) => `${c.type}/${c.relation}/${c.action}/${c.source} ${agents.get(nodes.get(c.nodeId)?.agentId as any)}:${nodes.get(c.nodeId)?.label ?? nodes.get(c.nodeId)?.text} vs ${c.againstNodeId ? `${agents.get(nodes.get(c.againstNodeId)?.agentId as any)}:${nodes.get(c.againstNodeId)?.label ?? nodes.get(c.againstNodeId)?.text}` : "-"} [${c.status}]`);
    const tasks = (await ctx.db.query("tasks").collect()).map((x) => `${agents.get(x.agentId)} ${x.subject} = ${x.status}${x.note ? ` (${x.note})` : ""}`);
    const lessons = [...nodes.values()].filter((n) => n.kind === "knowledge").map((n) => `${agents.get(n.agentId)} ${n.text}`);
    return { cls, tasks, lessons };
  });
  console.log([...log, "--- classifications", ...dump.cls, "--- tasks", ...dump.tasks, "--- knowledge", ...dump.lessons].join("\n"));
  expect(1).toBe(1);
}, 120_000);
