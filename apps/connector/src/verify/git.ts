import { spawnSync } from "node:child_process";

export type Run = { code: number; out: string };

export function git(cwd: string, args: string[]): Run {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function gitOk(cwd: string, args: string[]): string {
  const r = git(cwd, args);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.out.trim()}`);
  return r.out.trim();
}

export type Conflict = { a: string; b: string; files: string[] };

/** Rule R3: `git merge-tree --write-tree` predicts textual conflicts without touching any checkout. */
export function pairConflicts(root: string, branches: string[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i];
      const b = branches[j];
      if (!a || !b) continue;
      const r = git(root, ["merge-tree", "--write-tree", "--name-only", "--no-messages", a, b]);
      if (r.code !== 1) continue;
      const files = r.out.trim().split("\n").slice(1).filter(Boolean);
      out.push({ a, b, files });
    }
  }
  return out;
}

/** Merges `branch` into the worktree; on conflict records the files and aborts so later merges still run. */
export function mergeInto(worktree: string, base: string, branch: string): Conflict | null {
  const r = git(worktree, ["merge", "--no-edit", "--no-ff", "-m", `lb verify: merge ${branch}`, branch]);
  if (r.code === 0) return null;
  const files = git(worktree, ["diff", "--name-only", "--diff-filter=U"])
    .out.trim()
    .split("\n")
    .filter(Boolean);
  git(worktree, ["merge", "--abort"]);
  return { a: base, b: branch, files };
}
