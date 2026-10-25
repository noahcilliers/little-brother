import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunRecord } from "../aggregate";
import type { Arm } from "../arm";
import { closeRun, openRun, snapshot } from "../backend";
import type { EvalCase } from "../case";
import { distinctCatchSavings } from "../catches";
import { removeWorkspace } from "../cleanup";
import { shOrThrow } from "../exec";
import { hookUsage, parseTimingLog } from "../hook-timing";
import { runAgents, type Started, sleep, timingFile } from "../run-agents";
import type { RunContext } from "../run-case";
import { scoreRun } from "../score";
import { logTokens } from "../stream";
import { addTokens, ZERO_TOKENS } from "../tokens";
import { branchOf, commitAgentWork } from "../workspace";
import type { PairGrade, PairTask } from "./pair-task";

/** The planted-suite case shape, so external pairs reuse the same agent scheduling and scoring. */
export function asCase(t: PairTask): EvalCase {
  const [a, b] = t.agents;
  return {
    id: t.id,
    title: t.id,
    why: t.kind,
    agents: t.agents.map((x) => ({
      handle: x.handle,
      prompt: { pointed: x.prompt, natural: x.prompt },
      ...(x.afterFirstEditOf
        ? { start: { after: { agent: x.afterFirstEditOf, event: "firstEdit" as const } } }
        : {}),
    })),
    expect:
      t.expectClash && a && b
        ? [{ agents: [a.handle, b.handle], type: "conflict", evidence: ["clash"] }]
        : [],
    checks: [],
  };
}

/** A private clone per run, sharing the cache's objects, with one branch and worktree per agent at `base`. */
function pairWorkspace(t: PairTask, wsDir: string): { repo: string; worktrees: Map<string, string> } {
  const repo = join(wsDir, "repo");
  mkdirSync(wsDir, { recursive: true });
  shOrThrow("git", ["clone", "-q", "--shared", "--no-checkout", t.repoCache, repo], wsDir);
  const worktrees = new Map<string, string>();
  for (const a of t.agents) {
    const dir = join(wsDir, a.handle);
    shOrThrow("git", ["worktree", "add", "-q", "-b", branchOf(a.handle), dir, t.base], repo);
    worktrees.set(a.handle, dir);
  }
  return { repo, worktrees };
}

const readTiming = (file: string) => (existsSync(file) ? parseTimingLog(readFileSync(file, "utf8")) : []);

export type PairRecord = RunRecord & { kind: string; grade?: PairGrade };

/** One external pair, one arm, one repetition: agents live, then grade the branches and the merge. */
export async function runPair(t: PairTask, arm: Arm, run: number, ctx: RunContext): Promise<PairRecord> {
  const c = asCase(t);
  const name = `${t.suite}-${t.id.replaceAll("/", "_")}-${arm}-${run}`;
  const runDir = join(ctx.outDir, "runs", name);
  const code = `ev${ctx.tag}-${createHash("sha1").update(name).digest("hex").slice(0, 10)}`;
  mkdirSync(runDir, { recursive: true });
  const t0 = Date.now();
  const base = { suite: t.suite, kind: t.kind, caseId: t.id, variant: "pointed" as const, arm, run };
  const handles = t.agents.map((a) => a.handle);
  let started = new Map<string, Started>();
  const spent = () => [...started.values()].reduce((n, s) => n + s.agent.log.costUsd, 0);
  const tokens = () =>
    [...started.values()].map((s) => logTokens(s.agent.log)).reduce(addTokens, ZERO_TOKENS);
  const wsDir = join(ctx.workDir, name);
  try {
    rmSync(wsDir, { recursive: true, force: true });
    const ws = pairWorkspace(t, wsDir);
    if (arm === "on") openRun(ctx.backend, code, name);
    const pairCtx: RunContext = { ...ctx, agentEnv: (_h, cwd) => t.env(cwd), extraTools: t.extraTools };
    started = await runAgents(c, "pointed", arm, runDir, code, pairCtx, ws.worktrees);
    const agentsDone = { tokens: tokens(), costUsd: spent(), wallSec: (Date.now() - t0) / 1000 };
    const timingLog = handles.flatMap((h) => readTiming(timingFile(runDir, h)));
    let snap: ReturnType<typeof snapshot> | null = null;
    if (arm === "on") {
      await sleep(ctx.settleSec * 1000);
      snap = snapshot(ctx.backend, code);
      closeRun(ctx.backend, code);
    }
    for (const [h, dir] of ws.worktrees) commitAgentWork(dir, h);
    const grade = await t.grade({ repo: ws.repo, base: t.base, handles, dir: join(wsDir, "grade") });
    const timing = handles.map((h) => ({
      handle: h,
      startedAt: started.get(h)?.startedAt ?? null,
      firstEditAt: started.get(h)?.agent.log.firstEditAt ?? null,
    }));
    const classifications = snap?.classifications ?? [];
    const score = scoreRun(c, classifications, timing, [{ id: "clash", value: grade.clash, detail: "" }]);
    const catches = distinctCatchSavings(classifications);
    const record: PairRecord = {
      ...base,
      score,
      costUsd: agentsDone.costUsd,
      tokens: agentsDone.tokens,
      wallSec: agentsDone.wallSec,
      ...(snap ? { hooks: hookUsage(timingLog, catches.tokensSaved), catches: catches.catches } : {}),
      phases: { agents: agentsDone },
      finalSuccess: grade.success,
      mergeConflict: grade.mergeConflict,
      grade,
    };
    const agents = [...started].map(([h, s]) => ({
      handle: h,
      startedAt: s.startedAt,
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
      JSON.stringify({ ...record, code, agents, snapshot: snap }, null, 2),
    );
    return record;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const record: PairRecord = {
      ...base,
      score: { control: !t.expectClash, expectations: [], falsePositives: [] },
      costUsd: spent(),
      tokens: tokens(),
      wallSec: (Date.now() - t0) / 1000,
      error,
    };
    writeFileSync(join(runDir, "run.json"), JSON.stringify({ ...record, code }, null, 2));
    return record;
  } finally {
    if (!ctx.keepWorkspaces) removeWorkspace(wsDir);
  }
}
