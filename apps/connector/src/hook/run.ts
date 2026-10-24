import { hostname } from "node:os";
import { HookInput, type IngestEnvelope, IngestResponse } from "@lb/core";
import { activeProfile } from "../config";
import { HttpError, postJson } from "../http";
import { type Normalized, normalizeTool } from "../normalize";
import { loadTopicMap } from "../normalize/topic-map";
import { sessionCodeFor } from "./attach";
import { startBackgroundMergeCheck } from "./background";
import { buildEnvelope } from "./envelope";
import { type RepoInfo, repoInfo } from "./git";
import { baseRev, gitOpFor } from "./git-state";
import { appendOutbox, flushOutbox, type OutboxEntry } from "./outbox";
import { handleSessionCommand } from "./session-command";
import { writeSessionId } from "./session-file";
import { transcriptTokens, transcriptToolUsage } from "./transcript";

export type HookRunOptions = {
  /** Profile handle; replay uses it to act as several members from one machine. */
  as?: string;
  /** Overrides the hook input's cwd so one machine can simulate several checkouts. */
  cwd?: string;
  timeoutMs?: number;
  flushTimeoutMs?: number;
  /** Lets Stop spawn the detached merge check; only the real `lb hook` entry turns it on. */
  background?: boolean;
  /** The Little Brother session code; defaults to LB_SESSION, then what this Claude session joined. */
  session?: string;
};

export type HookResult = { output: unknown; envelope?: IngestEnvelope; delivered: boolean; error?: string };

const HOOK_TIMEOUT_MS = 1500;

/** 4xx means the backend saw and rejected the event; resending it would fail the same way. */
const retryable = (e: unknown): boolean =>
  !(e instanceof HttpError) || e.status >= 500 || e.status === 408 || e.status === 429;
const FLUSH_TIMEOUT_MS = 800;

async function normalizeFor(input: HookInput, root: string): Promise<Normalized | undefined> {
  const n = input.hook_event_name;
  if (n !== "PreToolUse" && n !== "PostToolUse" && n !== "PostToolUseFailure") return undefined;
  return normalizeTool({
    tool: input.tool_name,
    input: input.tool_input,
    cwd: input.cwd,
    repoRoot: root,
    phase: n === "PreToolUse" ? "pre" : "post",
    toolResponse: "tool_response" in input ? input.tool_response : undefined,
  });
}

const USAGE_HOOKS = new Set(["Stop", "SessionEnd", "PreCompact"]);
const WORK_TOOLS = new Set(["Edit", "Write", "MultiEdit", "Bash"]);

/** baseRev on every work tool; the git op (with fresh HEAD state) once a Bash command has finished. */
function addGitContext(input: HookInput, envelope: IngestEnvelope, repo: RepoInfo): void {
  const n = input.hook_event_name;
  if (n !== "PreToolUse" && n !== "PostToolUse" && n !== "PostToolUseFailure") return;
  if (!WORK_TOOLS.has(input.tool_name)) return;
  try {
    const base = baseRev(repo);
    if (base) envelope.baseRev = base;
    if (n !== "PreToolUse" && envelope.command) {
      const op = gitOpFor(envelope.command, input.cwd, envelope.exitCode);
      if (op) envelope.git = op;
    }
  } catch {
    // git context is an enrichment; the event still goes out without it
  }
}

function parseInput(event: string, raw: unknown, cwd?: string): HookInput | string {
  try {
    const obj: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof obj !== "object" || obj === null) return "hook input is not an object";
    const withDefaults = { hook_event_name: event, ...obj, ...(cwd ? { cwd } : {}) };
    const parsed = HookInput.safeParse(withDefaults);
    return parsed.success ? parsed.data : parsed.error.message;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function deliver(entry: OutboxEntry, timeoutMs: number): Promise<unknown> {
  const profile = activeProfile(entry.as);
  if (!profile) throw new Error("not joined: run `lb join`");
  const url = `${profile.siteUrl}/hook/${entry.envelope.hook}`;
  return postJson(url, entry.envelope, { token: profile.token, timeoutMs });
}

const additional = (output: unknown): string => {
  const out = output as { hookSpecificOutput?: { additionalContext?: unknown } } | null;
  const text = out?.hookSpecificOutput?.additionalContext;
  return typeof text === "string" ? text : "";
};

/** Join registers the Claude session at once (as a SessionStart would) so the reply carries the team digest. */
async function joinOrLeave(input: HookInput, opts: HookRunOptions): Promise<HookResult | null> {
  const cmd = await handleSessionCommand(input, opts.as);
  if (!cmd) return null;
  const synthetic = (hook: string) => ({
    ...input,
    hook_event_name: hook,
    source: "resume",
    reason: "other",
  });
  if (cmd.left) await runHook("SessionEnd", synthetic("SessionEnd"), { ...opts, session: cmd.left });
  if (!cmd.joined) return { output: cmd.output, delivered: false };
  const start = await runHook("SessionStart", synthetic("SessionStart"), { ...opts, session: cmd.joined });
  const text = [additional(cmd.output), additional(start.output)].filter(Boolean).join("\n\n");
  return {
    output: { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text } },
    delivered: start.delivered,
  };
}

/**
 * The whole hook path. Never throws; on any failure the envelope is queued in the outbox. A Claude session
 * that has not joined a Little Brother session stops here, before any network call.
 */
export async function runHook(event: string, raw: unknown, opts: HookRunOptions = {}): Promise<HookResult> {
  const input = parseInput(event, raw, opts.cwd);
  if (typeof input === "string") return { output: null, delivered: false, error: input };
  let envelope: IngestEnvelope | undefined;
  try {
    if (input.hook_event_name === "SessionStart") {
      writeSessionId(input.session_id, opts.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? input.cwd);
    }
    const command = await joinOrLeave(input, opts);
    if (command) return command;
    const code = sessionCodeFor(input.session_id, opts.session);
    if (!code)
      return { output: null, delivered: false, error: "this Claude session has not joined a session" };
    const repo = repoInfo(input.cwd);
    envelope = buildEnvelope(input, {
      repo: repo.repo,
      branch: repo.branch,
      machine: hostname(),
      normalized: await normalizeFor(input, repo.root),
      tokens: input.hook_event_name === "Stop" ? transcriptTokens(input.transcript_path) : undefined,
      // The transcript can lag mid-turn; by Stop, SessionEnd and PreCompact the turn's usage is written.
      usage: USAGE_HOOKS.has(input.hook_event_name) ? transcriptToolUsage(input.transcript_path) : undefined,
      now: Date.now(),
    });
    envelope.session.lbSession = code;
    if (input.hook_event_name === "SessionStart") envelope.topicMap = loadTopicMap(repo.root);
    addGitContext(input, envelope, repo);
    if (input.hook_event_name === "Stop" && opts.background)
      startBackgroundMergeCheck(repo, input.session_id, opts.as);
    const entry: OutboxEntry = { as: opts.as, envelope };
    const res = await deliver(entry, opts.timeoutMs ?? HOOK_TIMEOUT_MS).catch((e: unknown) => {
      if (retryable(e)) appendOutbox(entry);
      throw e;
    });
    const body = IngestResponse.parse(res);
    const resend = (e: OutboxEntry): Promise<void> =>
      deliver(e, opts.flushTimeoutMs ?? FLUSH_TIMEOUT_MS).then(
        () => undefined,
        (err: unknown) => {
          if (retryable(err)) throw err;
        },
      );
    await flushOutbox(resend).catch(() => 0);
    return { output: body.output ?? null, envelope, delivered: true };
  } catch (e) {
    return { output: null, envelope, delivered: false, error: e instanceof Error ? e.message : String(e) };
  }
}
