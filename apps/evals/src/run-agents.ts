import { join } from "node:path";
import { type AgentLaunch, endSession, type RunningAgent, startAgent } from "./agent";
import type { Arm } from "./arm";
import type { EvalCase, Variant } from "./case";
import type { RunContext } from "./run-case";
import { type AgentState, dueAt } from "./triggers";

const TICK_MS = 500;
export const timingFile = (runDir: string, handle: string) => join(runDir, `${handle}.hooks.jsonl`);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Started = {
  agent: RunningAgent;
  startedAt: number;
  fallback: boolean;
  exit?: { code: number | null; timedOut: boolean };
};

/** Starts each agent when its trigger fires and resolves once every agent has exited. */
export async function runAgents(
  c: EvalCase,
  variant: Variant,
  arm: Arm,
  runDir: string,
  code: string,
  ctx: RunContext,
  worktrees: Map<string, string>,
) {
  const states = new Map<string, AgentState>(
    c.agents.map((a) => [a.handle, { startedAt: null, firstEditAt: null, doneAt: null }]),
  );
  const started = new Map<string, Started>();
  const runStart = Date.now();
  while (started.size < c.agents.length || [...states.values()].some((s) => s.doneAt === null)) {
    for (const spec of c.agents) {
      if (started.has(spec.handle)) continue;
      const due = dueAt(spec.start, runStart, states);
      if (!due || due.at > Date.now()) continue;
      const state = states.get(spec.handle);
      const cwd = worktrees.get(spec.handle);
      if (!state || !cwd) throw new Error(`no state or worktree for ${spec.handle}`);
      state.startedAt = Date.now();
      const launch: AgentLaunch = {
        handle: spec.handle,
        prompt: spec.prompt[variant],
        cwd,
        sessionCode: code,
        lbHome: ctx.lbHome,
        sessionDir: join(runDir, "lb-sessions", spec.handle),
        pluginDir: ctx.pluginDir,
        mcpConfig: ctx.mcpConfig,
        lb: arm === "on",
        logFile: join(runDir, `${spec.handle}.stream.jsonl`),
        timingFile: timingFile(runDir, spec.handle),
        limits: ctx.limits,
        ...(ctx.agentEnv ? { extraEnv: ctx.agentEnv(spec.handle, cwd) } : {}),
        ...(ctx.extraTools ? { extraTools: ctx.extraTools } : {}),
        onFirstEdit: () => {
          state.firstEditAt = Date.now();
        },
      };
      const agent = startAgent(launch);
      const entry: Started = { agent, startedAt: state.startedAt, fallback: due.fallback };
      started.set(spec.handle, entry);
      void agent.done.then((exit) => {
        if (spec.endsSession && arm === "on") endSession(launch, agent.sessionId, ctx.cliPath);
        entry.exit = exit;
        state.doneAt = Date.now();
      });
    }
    await sleep(TICK_MS);
  }
  return started;
}
