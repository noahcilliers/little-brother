import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeProfile } from "../config";
import { postJson } from "../http";
import { tailLines } from "../normalize/text";
import { loadTopicMap } from "../normalize/topic-map";
import { type Conflict, git, gitOk, mergeInto, pairConflicts } from "../verify/git";

export type VerifyResult = { branches: string[]; passed: boolean; outputTail: string; conflicts: Conflict[] };

function runVerify(cmd: string | undefined, cwd: string): { ok: boolean; tail: string } {
  if (!cmd) return { ok: true, tail: "no `verify` command in .littlebrother.json; merge check only" };
  const r = spawnSync("sh", ["-c", cmd], {
    cwd,
    encoding: "utf8",
    timeout: 10 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, tail: tailLines(`${r.stdout ?? ""}${r.stderr ?? ""}`) || `exit ${r.status}` };
}

function dedupe(conflicts: Conflict[]): Conflict[] {
  const seen = new Map<string, Conflict>();
  for (const c of conflicts) {
    const key = [c.a, c.b].sort().join("\u0000");
    const prev = seen.get(key);
    seen.set(key, prev ? { ...prev, files: [...new Set([...prev.files, ...c.files])] } : c);
  }
  return [...seen.values()];
}

export function verifyBranches(repoDir: string, branches: string[]): VerifyResult {
  const root = gitOk(repoDir, ["rev-parse", "--show-toplevel"]);
  const [first, ...rest] = branches;
  if (!first) throw new Error("lb verify needs at least one branch");
  const conflicts = pairConflicts(root, branches);
  const tmp = mkdtempSync(join(tmpdir(), "lb-verify-"));
  const worktree = join(tmp, "wt");
  try {
    gitOk(root, ["worktree", "add", "--detach", worktree, first]);
    const mergeConflicts = rest.flatMap((b) => mergeInto(worktree, first, b) ?? []);
    const all = dedupe([...conflicts, ...mergeConflicts]);
    const verify = runVerify(loadTopicMap(worktree).verify, worktree);
    return {
      branches,
      passed: verify.ok && mergeConflicts.length === 0,
      outputTail: verify.tail,
      conflicts: all,
    };
  } finally {
    git(root, ["worktree", "remove", "--force", worktree]);
    rmSync(tmp, { recursive: true, force: true });
    git(root, ["worktree", "prune"]);
  }
}

export async function verifyCommand(branches: string[], opts: { repo?: string }): Promise<void> {
  const result = verifyBranches(opts.repo ?? process.cwd(), branches);
  console.log(`${result.passed ? "PASS" : "FAIL"} · ${branches.join(" + ")}`);
  for (const c of result.conflicts)
    console.log(`  conflict ${c.a} × ${c.b}: ${c.files.join(", ") || "(unknown files)"}`);
  console.log(
    result.outputTail
      .split("\n")
      .map((l) => `  │ ${l}`)
      .join("\n"),
  );
  const p = activeProfile();
  if (!p) {
    console.log("not joined; result not reported");
  } else {
    try {
      await postJson(`${p.siteUrl}/verify`, result, { token: p.token, timeoutMs: 5000 });
      console.log("reported to little-brother");
    } catch (e) {
      console.log(`could not report: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  process.exitCode = result.passed ? 0 : 1;
}
