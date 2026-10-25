import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TokenCounts } from "@lb/core";
import { type Limits, startAgent } from "./agent";
import { DEFAULT_SUCCESS_RUN, type Success } from "./case";
import { walkFiles } from "./cleanup";
import { sh, shAsync, shOrThrow } from "./exec";
import { matchingFiles } from "./grep-ref";
import { logTokens } from "./stream";
import { branchOf } from "./workspace";

const GIT_ID = ["-c", "user.name=lb-evals", "-c", "user.email=evals@little-brother.dev"];
const COMMAND_TIMEOUT_MS = 5 * 60_000;
const MARKER = /^(<<<<<<<|>>>>>>>) /;

export const FIXUP_NOTE = [
  "You are integrating teammates' work: their branches are merged in your working directory.",
  "Work only in your working directory. Don't commit or push, and don't start long-running servers.",
  "Stop as soon as the listed commands pass.",
].join(" ");

/** Per-phase usage, so a run's totals can be split into the agents' work and integration. */
export type PhaseUsage = { tokens: TokenCounts; costUsd: number; wallSec: number };

export type FixupResult = PhaseUsage & {
  /** Branches whose merge conflicted; their markers were left in the tree for the agent. */
  conflicted: string[];
  success: boolean;
  checks: { id: string; ok: boolean; detail: string }[];
  exit: { code: number | null; timedOut: boolean };
};

/**
 * A tree with every agent branch merged in order. A conflicting merge is committed with its markers, so the
 * next branch still merges and the fix-up agent sees exactly what a human integrator would.
 */
export function mergeWithMarkers(repo: string, dir: string, handles: string[], branch: string): string[] {
  shOrThrow("git", ["worktree", "add", "-q", "-b", branch, dir, "main"], repo);
  const conflicted: string[] = [];
  for (const h of handles) {
    if (sh("git", [...GIT_ID, "merge", "--no-edit", "-q", branchOf(h)], dir).ok) continue;
    conflicted.push(branchOf(h));
    shOrThrow("git", ["add", "-A"], dir);
    shOrThrow(
      "git",
      [...GIT_ID, "commit", "-q", "--no-verify", "-m", `merge ${branchOf(h)} (conflicts)`],
      dir,
    );
  }
  return conflicted;
}

export function fixupPrompt(tasks: { handle: string; prompt: string }[], conflicted: boolean, run: string[]) {
  return [
    `${tasks.length} teammates worked on this repo in parallel, each on their own branch, and their branches have just been merged here${conflicted ? ". The merge conflicted: git conflict markers are still in some files" : ""}.`,
    "",
    ...tasks.map((t, i) => `Teammate ${i + 1} (${t.handle}) was asked: ${t.prompt}`),
    "",
    "Make the merged code work. Resolve any conflict markers and keep every teammate's feature intact; where two tasks contradict each other, keep one coherent approach and say which. These commands must pass:",
    ...run.map((c) => `- \`${c}\``),
  ].join("\n");
}

function trackedFiles(dir: string): string[] {
  const r = sh("git", ["ls-files", "-co", "--exclude-standard"], dir);
  // A tree restored from its archive (--recheck) has no git metadata.
  if (!r.ok) return walkFiles(dir);
  return r.out.split("\n").filter((f) => f && !f.startsWith("node_modules/"));
}

const under = (paths: string[] | undefined) => (f: string) =>
  !paths?.length || paths.some((p) => f === p || f.startsWith(`${p.replace(/\/$/, "")}/`));

/** The integrated tree passes when it has no markers, every command exits 0, and every feature is there. */
export async function checkSuccess(dir: string, success: Success | undefined) {
  const files = trackedFiles(dir);
  const read = (fs: string[]) =>
    fs.flatMap((f): [string, string][] => {
      try {
        return [[f, readFileSync(join(dir, f), "utf8")]];
      } catch {
        return [];
      }
    });
  const markers = read(files).filter(([, c]) => c.split("\n").some((l) => MARKER.test(l)));
  const checks: FixupResult["checks"] = [
    {
      id: "no-markers",
      ok: markers.length === 0,
      detail: markers.length ? markers.map(([f]) => f).join(", ") : "clean",
    },
  ];
  for (const cmd of success?.run ?? DEFAULT_SUCCESS_RUN) {
    const r = await shAsync(cmd, dir, COMMAND_TIMEOUT_MS);
    const tail = r.out.trim().split("\n").slice(-3).join(" ⏎ ").slice(0, 300);
    checks.push({ id: cmd, ok: r.ok, detail: `exit ${r.code}: ${tail}` });
  }
  for (const i of success?.intact ?? []) {
    const hits = matchingFiles(read(files.filter(under(i.paths))), i.pattern);
    checks.push({ id: i.id, ok: hits.length >= (i.minFiles ?? 1), detail: hits.join(", ") || "missing" });
  }
  return { success: checks.every((c) => c.ok), checks };
}

export type FixupLaunch = {
  repo: string;
  dir: string;
  handles: string[];
  tasks: { handle: string; prompt: string }[];
  success: Success | undefined;
  runDir: string;
  lbHome: string;
  limits: Limits;
  linkDeps: (dir: string) => void;
};

/** Merges every branch, lets one more agent (Little Brother off, in both arms) integrate, then checks it. */
export async function runFixup(f: FixupLaunch): Promise<FixupResult> {
  const t0 = Date.now();
  const conflicted = mergeWithMarkers(f.repo, f.dir, f.handles, "eval/fixup");
  f.linkDeps(f.dir);
  const agent = startAgent({
    handle: "integrator",
    prompt: fixupPrompt(f.tasks, conflicted.length > 0, f.success?.run ?? DEFAULT_SUCCESS_RUN),
    cwd: f.dir,
    sessionCode: "",
    lbHome: f.lbHome,
    sessionDir: join(f.runDir, "lb-sessions", "integrator"),
    pluginDir: "",
    mcpConfig: "",
    lb: false,
    logFile: join(f.runDir, "integrator.stream.jsonl"),
    timingFile: join(f.runDir, "integrator.hooks.jsonl"),
    limits: f.limits,
    systemNote: FIXUP_NOTE,
    onFirstEdit: () => {},
  });
  const exit = await agent.done;
  const wallSec = (Date.now() - t0) / 1000;
  const { success, checks } = await checkSuccess(f.dir, f.success);
  return {
    tokens: logTokens(agent.log),
    costUsd: agent.log.costUsd,
    wallSec,
    conflicted,
    success,
    checks,
    exit,
  };
}
