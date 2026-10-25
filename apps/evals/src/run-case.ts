import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Limits } from "./agent";
import type { RunRecord } from "./aggregate";
import type { Arm } from "./arm";
import { type Backend, closeRun, openRun, snapshot } from "./backend";
import type { EvalCase, Variant } from "./case";
import { distinctCatchSavings } from "./catches";
import { archiveTree, removeWorkspace } from "./cleanup";
import { type FixupResult, runFixup } from "./fixup";
import { hookUsage, parseTimingLog } from "./hook-timing";
import { mergeAll, runChecks } from "./oracle";
import { runAgents, type Started, sleep, timingFile } from "./run-agents";
import { scoreRun } from "./score";
import { logTokens } from "./stream";
import { addTokens, ZERO_TOKENS } from "./tokens";
import { commitAgentWork, createWorkspace, linkModules } from "./workspace";

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
  /** Per-agent variables for suites outside the demo shop (a Python checkout's PATH and PYTHONPATH). */
  agentEnv?: (handle: string, cwd: string) => Record<string, string>;
  extraTools?: string[];
  /** Run a fix-up agent on the merged tree after the agents finish (fixup.ts). */
  fixup: boolean;
  /** Keep each run's repo and worktrees after grading; by default only results are kept (cleanup.ts). */
  keepWorkspaces?: boolean;
};

const readTiming = (file: string) => (existsSync(file) ? parseTimingLog(readFileSync(file, "utf8")) : []);

/** Little Brother output in an `off` run means the arm leaked, and its token totals would be meaningless. */
function assertNoLb(started: Map<string, Started>, timingLines: number): void {
  const heard = [...started].filter(([, s]) => s.agent.log.lbMessages.length).map(([h]) => h);
  if (timingLines || heard.length)
    throw new Error(
      `off arm reached Little Brother (${timingLines} hook calls, messages to ${heard.join(", ") || "none"})`,
    );
}

/** One case, prompt variant, arm and repetition: run the agents live, then read back and score. */
export async function runCase(
  c: EvalCase,
  variant: Variant,
  arm: Arm,
  run: number,
  ctx: RunContext,
): Promise<RunRecord> {
  const name = arm === "on" ? `${c.id}-${variant}-${run}` : `${c.id}-${variant}-off-${run}`;
  const runDir = join(ctx.outDir, "runs", name);
  // Session codes are capped at 40 characters; a longer one is dropped and the hooks fail open silently.
  const code = `ev${ctx.tag}-${createHash("sha1").update(name).digest("hex").slice(0, 10)}`;
  mkdirSync(runDir, { recursive: true });
  const t0 = Date.now();
  const base = { caseId: c.id, variant, arm, run };
  const handles = c.agents.map((a) => a.handle);
  let started = new Map<string, Started>();
  const spent = () => [...started.values()].reduce((n, s) => n + s.agent.log.costUsd, 0);
  const tokens = () =>
    [...started.values()].map((s) => logTokens(s.agent.log)).reduce(addTokens, ZERO_TOKENS);
  const wsDir = join(ctx.workDir, name);
  try {
    rmSync(wsDir, { recursive: true, force: true });
    const ws = createWorkspace(ctx.shopSrc, wsDir, handles, ctx.modules);
    if (arm === "on") openRun(ctx.backend, code, name);
    started = await runAgents(c, variant, arm, runDir, code, ctx, ws.worktrees);
    const timingLog = handles.flatMap((h) => readTiming(timingFile(runDir, h)));
    let snap: ReturnType<typeof snapshot> | null = null;
    if (arm === "on") {
      await sleep(ctx.settleSec * 1000);
      snap = snapshot(ctx.backend, code);
      const seen = new Set(snap.agents.map((a) => a.handle));
      const unseen = [...started.keys()].filter((h) => !seen.has(h));
      if (unseen.length) throw new Error(`no hook from ${unseen.join(", ")} reached session ${code}`);
      closeRun(ctx.backend, code);
    } else assertNoLb(started, timingLog.length);
    for (const [h, dir] of ws.worktrees) commitAgentWork(dir, h);
    const merged = mergeAll(ws, wsDir, handles, ctx.modules);
    const logs = new Map([...started].map(([h, s]) => [h, s.agent.log]));
    const checks = await runChecks(c, ws, merged, logs);
    const timing = handles.map((h) => ({
      handle: h,
      startedAt: started.get(h)?.startedAt ?? null,
      firstEditAt: started.get(h)?.agent.log.firstEditAt ?? null,
    }));
    const classifications = snap?.classifications ?? [];
    const score = scoreRun(c, classifications, timing, checks);
    const catches = distinctCatchSavings(classifications);
    const hooks = snap ? hookUsage(timingLog, catches.tokensSaved) : undefined;
    const agentsUsage = { tokens: tokens(), costUsd: spent(), wallSec: (Date.now() - t0) / 1000 };
    let fixup: FixupResult | null = null;
    if (ctx.fixup)
      fixup = await runFixup({
        repo: ws.repo,
        dir: join(wsDir, "fixup"),
        handles,
        tasks: c.agents.map((a) => ({ handle: a.handle, prompt: a.prompt[variant] })),
        success: c.success,
        runDir,
        lbHome: ctx.lbHome,
        limits: ctx.limits,
        linkDeps: (dir) => linkModules(ctx.modules, dir),
      });
    const record: RunRecord = {
      ...base,
      score,
      costUsd: agentsUsage.costUsd + (fixup?.costUsd ?? 0),
      tokens: fixup ? addTokens(agentsUsage.tokens, fixup.tokens) : agentsUsage.tokens,
      wallSec: (Date.now() - t0) / 1000,
      ...(hooks ? { hooks } : {}),
      ...(snap ? { catches: catches.catches } : {}),
      phases: {
        agents: agentsUsage,
        ...(fixup ? { fixup: { tokens: fixup.tokens, costUsd: fixup.costUsd, wallSec: fixup.wallSec } } : {}),
      },
      ...(fixup ? { finalSuccess: fixup.success, mergeConflict: fixup.conflicted.length > 0 } : {}),
    };
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
      tokens: logTokens(s.agent.log),
      turns: s.agent.log.turns,
      result: s.agent.log.resultText.slice(0, 2000),
    }));
    writeFileSync(
      join(runDir, "run.json"),
      JSON.stringify({ ...record, code, agents, checks, merged, fixup, snapshot: snap }, null, 2),
    );
    return record;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const record: RunRecord = {
      ...base,
      score: { control: c.expect.length === 0, expectations: [], falsePositives: [] },
      costUsd: spent(),
      tokens: tokens(),
      wallSec: (Date.now() - t0) / 1000,
      error,
    };
    writeFileSync(join(runDir, "run.json"), JSON.stringify({ ...record, code }, null, 2));
    return record;
  } finally {
    if (!ctx.keepWorkspaces) {
      archiveTree(join(wsDir, "fixup"), join(runDir, "fixup.tar"));
      removeWorkspace(wsDir);
    }
  }
}
