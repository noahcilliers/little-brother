import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import type { AgentLaunch, RunningAgent } from "./agent";
import type { LbRunner } from "./agent-spec";
import { translateLbLine } from "./lb-stream";
import { applyLine, emptyLog } from "./stream";

// Provider credentials and price overrides `lb agent` reads; the rest of its env is the Claude agent's.
const PROVIDER_ENV = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "LB_AGENT_PRICES"];

/**
 * The `lb agent` counterpart of `startAgent`: same worktree, prompt, session code and env. Little Brother off
 * means `--no-hooks` (no plugin to leave out). SessionEnd is held back as the eval plugin does for Claude.
 */
export function startLbAgent(a: AgentLaunch, runner: LbRunner, baseEnv: NodeJS.ProcessEnv): RunningAgent {
  const sessionId = randomUUID();
  const { spec } = runner;
  const args = [
    runner.cliPath,
    "agent",
    "--provider",
    spec.provider,
    "--model",
    spec.model,
    ...(spec.baseUrl ? ["--base-url", spec.baseUrl] : []),
    "--session-id",
    sessionId,
    "--cwd",
    a.cwd,
    "--max-turns",
    String(a.limits.maxTurns),
    "--max-budget-usd",
    String(a.limits.maxBudgetUsd),
    "--hold-session-end",
    ...(a.lb ? [] : ["--no-hooks"]),
    ...(a.systemNote ? ["--append-system-prompt", a.systemNote] : []),
  ];
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  for (const k of PROVIDER_ENV) if (process.env[k] !== undefined) env[k] = process.env[k];
  const child = spawn("node", args, { cwd: a.cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.end(a.prompt);
  const out = createWriteStream(a.logFile);
  const err = createWriteStream(`${a.logFile}.stderr`);
  child.stderr.pipe(err);
  const log = emptyLog();
  log.sessionId = sessionId;
  createInterface({ input: child.stdout }).on("line", (line) => {
    out.write(`${line}\n`);
    const claudeLine = translateLbLine(line);
    if (claudeLine && applyLine(log, claudeLine, a.cwd, Date.now())) a.onFirstEdit();
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, a.limits.timeoutMin * 60_000);
  const done = new Promise<{ code: number | null; timedOut: boolean }>((resolve) => {
    child.on("close", (code) => {
      clearTimeout(timer);
      out.end();
      err.end();
      resolve({ code, timedOut });
    });
    child.on("error", () => resolve({ code: null, timedOut }));
  });
  return { sessionId, log, done };
}
