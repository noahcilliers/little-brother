import { join } from "node:path";
import type { Check, EvalCase } from "./case";
import { sh, shAsync, shOrThrow } from "./exec";
import { grepRef } from "./grep-ref";
import type { CheckResult } from "./score";
import type { AgentLog } from "./stream";
import { branchOf, linkModules, type Workspace } from "./workspace";

const MERGED = "eval/merged";
const GIT_ID = ["-c", "user.name=lb-evals", "-c", "user.email=evals@little-brother.dev"];
const COMMAND_TIMEOUT_MS = 4 * 60_000;

export type MergeResult = { dir: string; skipped: { branch: string; files: string[] }[] };

/** Every agent branch merged into one tree; a branch that conflicts is left out and listed. */
export function mergeAll(ws: Workspace, runDir: string, handles: string[], modules: string): MergeResult {
  const dir = join(runDir, "merged");
  shOrThrow("git", ["worktree", "add", "-q", "-b", MERGED, dir, "main"], ws.repo);
  linkModules(modules, dir);
  const skipped: MergeResult["skipped"] = [];
  for (const h of handles) {
    const r = sh("git", [...GIT_ID, "merge", "--no-edit", "-q", branchOf(h)], dir);
    if (r.ok) continue;
    const files = sh("git", ["diff", "--name-only", "--diff-filter=U"], dir)
      .out.trim()
      .split("\n")
      .filter(Boolean);
    sh("git", ["merge", "--abort"], dir);
    skipped.push({ branch: branchOf(h), files });
  }
  return { dir, skipped };
}

const refOf = (on: string): string => (on === "merged" ? MERGED : branchOf(on));

function mergeConflict(repo: string, a: string, b: string): CheckResult["detail"] | null {
  const r = sh(
    "git",
    ["merge-tree", "--write-tree", "--name-only", "--no-messages", branchOf(a), branchOf(b)],
    repo,
  );
  if (r.code === 0) return null;
  const files = r.out.trim().split("\n").slice(1).filter(Boolean);
  return files.length ? files.join(", ") : r.out.trim().slice(0, 200);
}

async function runCheck(
  k: Exclude<Check, { kind: "allOf" }>,
  ws: Workspace,
  merged: MergeResult,
  logs: Map<string, AgentLog>,
): Promise<CheckResult> {
  if (k.kind === "mergeConflict") {
    const files = mergeConflict(ws.repo, k.agents[0], k.agents[1]);
    return { id: k.id, value: files !== null, detail: files ?? "merges cleanly" };
  }
  if (k.kind === "grep") {
    const files = grepRef(ws.repo, refOf(k.on), k.pattern, k.paths ?? []);
    return {
      id: k.id,
      value: files.length >= k.minFiles,
      detail: files.length ? files.join(", ") : "no match",
    };
  }
  if (k.kind === "commandFails") {
    const cwd = k.on === "merged" ? merged.dir : ws.worktrees.get(k.on);
    if (!cwd) return { id: k.id, value: false, detail: `no worktree for ${k.on}` };
    const r = await shAsync(k.run, cwd, COMMAND_TIMEOUT_MS);
    const tail = r.out.trim().split("\n").slice(-3).join(" ⏎ ").slice(0, 300);
    return { id: k.id, value: !r.ok, detail: `${k.run} → exit ${r.code}: ${tail}` };
  }
  const log = logs.get(k.agent);
  if (k.kind === "touched") {
    const hit = log ? [...log.touched].some((f) => f === k.file) : false;
    return {
      id: k.id,
      value: hit,
      detail: hit ? `${k.agent} edited ${k.file}` : `${k.agent} never edited ${k.file}`,
    };
  }
  const re = new RegExp(k.pattern);
  const cmd = log?.commands.find((c) => re.test(c));
  return {
    id: k.id,
    value: cmd !== undefined,
    detail: cmd ? `${k.agent} ran: ${cmd.slice(0, 120)}` : "never ran",
  };
}

/** Runs the case's checks after every agent's work is committed. */
export async function runChecks(
  c: EvalCase,
  ws: Workspace,
  merged: MergeResult,
  logs: Map<string, AgentLog>,
): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const k of c.checks) if (k.kind !== "allOf") out.push(await runCheck(k, ws, merged, logs));
  for (const k of c.checks) {
    if (k.kind !== "allOf") continue;
    const parts = k.of.map((id) => out.find((r) => r.id === id));
    const value = parts.every((r) => r?.value === true);
    out.push({ id: k.id, value, detail: parts.map((r, i) => `${k.of[i]}=${r?.value ?? "?"}`).join(", ") });
  }
  return out;
}
