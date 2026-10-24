import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { type AgentLog, applyLine, emptyLog } from "./stream";

export type Limits = { model: string; maxTurns: number; maxBudgetUsd: number; timeoutMin: number };

export type AgentLaunch = {
  handle: string;
  prompt: string;
  cwd: string;
  sessionCode: string;
  lbHome: string;
  sessionDir: string;
  pluginDir: string;
  mcpConfig: string;
  /** False for the `off` arm: no plugin and no lb MCP server, so no hooks run and no tools are offered. */
  lb: boolean;
  logFile: string;
  /** LB_TIMING_FILE for this agent's hooks: one JSON line per call. */
  timingFile: string;
  limits: Limits;
  onFirstEdit: () => void;
};

export type RunningAgent = {
  sessionId: string;
  log: AgentLog;
  done: Promise<{ code: number | null; timedOut: boolean }>;
};

/**
 * What an eval agent may do without asking; anything else is denied rather than left waiting. No `cat`/`ls`:
 * agents given `Bash(cat *)` write files with heredocs, which skips the file tools the hooks watch.
 */
export const ALLOWED_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "MultiEdit",
  "Glob",
  "Grep",
  "LS",
  "TodoWrite",
  "TaskCreate",
  "TaskUpdate",
  "TaskList",
  "TaskGet",
  "Bash(npm *)",
  "Bash(npx *)",
  "Bash(node *)",
  "Bash(git *)",
  "mcp__lb",
];

const SYSTEM_NOTE = [
  "You are one of several developers' Claude Code sessions working on this repo at the same time, each on its own branch.",
  "Do the task in your working directory only. Don't commit or push; the harness commits your branch when you finish.",
  "Don't start long-running servers (npm run dev, npm run web). Keep the change focused and stop when the task is done.",
].join(" ");

/** Only what Claude Code and the connector need: the parent's Claude Code variables would leak into the child. */
function agentEnv(a: AgentLaunch): NodeJS.ProcessEnv {
  const keep = ["HOME", "PATH", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "TERM", "ANTHROPIC_API_KEY"];
  const env: NodeJS.ProcessEnv = {};
  for (const k of keep) if (process.env[k] !== undefined) env[k] = process.env[k];
  return {
    ...env,
    LB_HOME: a.lbHome,
    LB_PROFILE: a.handle,
    LB_SESSION: a.sessionCode,
    LB_SESSION_DIR: a.sessionDir,
    LB_TIMING_FILE: a.timingFile,
    CLAUDE_CODE_ENABLE_TODO_TOOLS: "1",
  };
}

/** Runs the connector's SessionEnd hook for a finished agent, which the eval plugin otherwise holds back. */
export function endSession(a: AgentLaunch, sessionId: string, cliPath: string): void {
  const input = JSON.stringify({
    hook_event_name: "SessionEnd",
    session_id: sessionId,
    cwd: a.cwd,
    reason: "other",
  });
  spawnSync("node", [cliPath, "hook", "SessionEnd"], {
    cwd: a.cwd,
    env: agentEnv(a),
    input,
    timeout: 10_000,
  });
}

export function startAgent(a: AgentLaunch): RunningAgent {
  const sessionId = randomUUID();
  const args = [
    "-p",
    a.prompt,
    "--model",
    a.limits.model,
    "--output-format",
    "stream-json",
    "--verbose",
    "--session-id",
    sessionId,
    // Strict with no config file leaves the off arm with no MCP servers at all, not the user's own.
    "--strict-mcp-config",
    ...(a.lb ? ["--plugin-dir", a.pluginDir, "--mcp-config", a.mcpConfig] : []),
    "--setting-sources",
    "project",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    ...ALLOWED_TOOLS,
    "--max-turns",
    String(a.limits.maxTurns),
    "--max-budget-usd",
    String(a.limits.maxBudgetUsd),
    "--append-system-prompt",
    SYSTEM_NOTE,
  ];
  const child = spawn("claude", args, { cwd: a.cwd, env: agentEnv(a), stdio: ["ignore", "pipe", "pipe"] });
  const out = createWriteStream(a.logFile);
  const err = createWriteStream(`${a.logFile}.stderr`);
  child.stderr.pipe(err);
  const log = emptyLog();
  log.sessionId = sessionId;
  createInterface({ input: child.stdout }).on("line", (line) => {
    out.write(`${line}\n`);
    if (applyLine(log, line, a.cwd, Date.now())) a.onFirstEdit();
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
