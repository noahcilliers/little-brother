import { isAbsolute, join, relative, sep } from "node:path";

/** Repo-relative POSIX path; paths outside the repo stay absolute so they never collide with repo files. */
export function repoPath(p: string, cwd: string, repoRoot: string): { abs: string; rel: string } {
  const abs = isAbsolute(p) ? p : join(cwd, p);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) return { abs, rel: abs };
  return { abs, rel: (rel || ".").split(sep).join("/") };
}
