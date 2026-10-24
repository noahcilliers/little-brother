import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AgentLaunch, endSession, type Limits, type RunningAgent, startAgent } from "./agent";
import type { RunRecord } from "./aggregate";
import { type Backend, closeRun, openRun, snapshot } from "./backend";
import type { EvalCase, Variant } from "./case";
import { mergeAll, runChecks } from "./oracle";
import { scoreRun } from "./score";
import { type AgentState, dueAt } from "./triggers";
import { commitAgentWork, createWorkspace } from "./workspace";

export type RunContext = {
  backend: Backend;
  shopSrc: string;
  outDir: string;
  /** Where repos and worktrees go: outside this checkout, so agents don't load its CLAUDE.md files. */
  workDir: string;
  pluginDir: string;
  mcpConfig: string;
  cliPath: string;
  lbHome: string;
  modules: string;
  limits: Limits;
  tag: string;
  /** Wait after the last agent exits, so scheduled classifier actions (judge, re-classification) land. */
  settleSec: number;
};

const TICK_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Started = {
  agent: RunningAgent;
  startedAt: number;
  fallback: boolean;
  exit?: { code: number | null; timedOut: boolean };
};

async function runAgents(
  c: EvalCase,
  variant: Variant,
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
        logFile: join(runDir, `${spec.handle}.stream.jsonl`),
        limits: ctx.limits,
        onFirstEdit: () => {
          state.firstEditAt = Date.now();
        },
      };
      const agent = startAgent(launch);
      const entry: Started = { agent, startedAt: state.startedAt, fallback: due.fallback };
      started.set(spec.handle, entry);
      void agent.done.then((exit) => {
        if (spec.endsSession) endSession(launch, agent.sessionId, ctx.cliPath);
        entry.exit = exit;
        state.doneAt = Date.now();
      });
    }
    await sleep(TICK_MS);
  }
  return started;
}

/** One case, one prompt variant, one repetition: run the agents live, then read back and score. */
export async function runCase(
  c: EvalCase,
  variant: Variant,
  run: number,
  ctx: RunContext,
): Promise<RunRecord> {
  const name = `${c.id}-${variant}-${run}`;
  const runDir = join(ctx.outDir, "runs", name);
  // Session codes are capped at 40 characters; a longer one is dropped and the hooks fail open silently.
  const code = `ev${ctx.tag}-${createHash("sha1").update(name).digest("hex").slice(0, 10)}`;
  mkdirSync(runDir, { recursive: true });
  const t0 = Date.now();
  const base = { caseId: c.id, variant, run };
  const handles = c.agents.map((a) => a.handle);
  let started = new Map<string, Started>();
  const spent = () => [...started.values()].reduce((n, s) => n + s.agent.log.costUsd, 0);
  try {
    const wsDir = join(ctx.workDir, name);
    const ws = createWorkspace(ctx.shopSrc, wsDir, handles, ctx.modules);
    openRun(ctx.backend, code, name);
    started = await runAgents(c, variant, runDir, code, ctx, ws.worktrees);
    await sleep(ctx.settleSec * 1000);
    const snap = snapshot(ctx.backend, code);
    const seen = new Set(snap.agents.map((a) => a.handle));
    const unseen = [...started.keys()].filter((h) => !seen.has(h));
    if (unseen.length) throw new Error(`no hook from ${unseen.join(", ")} reached session ${code}`);
    closeRun(ctx.backend, code);
    for (const [h, dir] of ws.worktrees) commitAgentWork(dir, h);
    const merged = mergeAll(ws, wsDir, handles, ctx.modules);
    const logs = new Map([...started].map(([h, s]) => [h, s.agent.log]));
    const checks = await runChecks(c, ws, merged, logs);
    const timing = handles.map((h) => ({
      handle: h,
      startedAt: started.get(h)?.startedAt ?? null,
      firstEditAt: started.get(h)?.agent.log.firstEditAt ?? null,
    }));
    const score = scoreRun(c, snap.classifications, timing, checks);
    const costUsd = spent();
    const record: RunRecord = { ...base, score, costUsd, wallSec: (Date.now() - t0) / 1000 };
    const agents = [...started].map(([h, s]) => ({
      handle: h,
      sessionId: s.agent.sessionId,
      startedAt: s.startedAt,
      startFallback: s.fallback,
      exit: s.exit,
      firstEditAt: s.agent.log.firstEditAt,
      touched: [...s.agent.log.touched],
      commands: s.agent.log.commands,
      lbMessages: s.agent.log.lbMessages,
      costUsd: s.agent.log.costUsd,
      turns: s.agent.log.turns,
      result: s.agent.log.resultText.slice(0, 2000),
    }));
    writeFileSync(
      join(runDir, "run.json"),
      JSON.stringify({ ...record, code, agents, checks, merged, snapshot: snap }, null, 2),
    );
    return record;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const record: RunRecord = {
      ...base,
      score: { control: c.expect.length === 0, expectations: [], falsePositives: [] },
      costUsd: spent(),
      wallSec: (Date.now() - t0) / 1000,
      error,
    };
    writeFileSync(join(runDir, "run.json"), JSON.stringify({ ...record, code }, null, 2));
    return record;
  }
}
