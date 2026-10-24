import { sh } from "./exec";

/**
 * Files whose content has a line matching `pattern` (a JavaScript regex), like `git grep -l`. Matching runs
 * in JavaScript because `git grep -E` uses the platform's POSIX regex, and macOS's has no `\s`, `\w` or
 * `\b`: case checks written with them silently never matched there.
 */
export function matchingFiles(files: Iterable<[string, string]>, pattern: string): string[] {
  const re = new RegExp(pattern);
  const out: string[] = [];
  for (const [path, content] of files) if (content.split("\n").some((line) => re.test(line))) out.push(path);
  return out.sort();
}

/** Text files on `ref` under `paths` (all files when empty), read straight from git. */
function filesAt(repo: string, ref: string, paths: string[]): [string, string][] {
  const listed = sh("git", ["ls-tree", "-r", "--name-only", ref, "--", ...paths], repo);
  if (!listed.ok) return [];
  return listed.out
    .split("\n")
    .filter(Boolean)
    .flatMap((path): [string, string][] => {
      const r = sh("git", ["show", `${ref}:${path}`], repo);
      return r.ok && !r.out.includes("\u0000") ? [[path, r.out]] : [];
    });
}

export const grepRef = (repo: string, ref: string, pattern: string, paths: string[] = []): string[] =>
  matchingFiles(filesAt(repo, ref, paths), pattern);
