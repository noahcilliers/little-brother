import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { shellWrites } from "@lb/core";
import type { Phase } from "./edits";
import { type FileChange, fileChange } from "./file-change";
import { repoPath } from "./paths";

type Written = { rel: string; before: string | null; text: string | null | undefined };

function readOrNull(abs: string): string | null {
  try {
    return existsSync(abs) ? readFileSync(abs, "utf8") : null;
  } catch {
    return null;
  }
}

/** Text after one redirect; undefined once any write to the file has unknown content. */
function apply(cur: string | null | undefined, append: boolean, content: string | undefined) {
  if (content === undefined) return undefined;
  if (!append) return content;
  return cur === undefined ? undefined : (cur ?? "") + content;
}

/**
 * Files a Bash command writes via `>`, `>>` or `tee`, as Write-like touches. Only PreToolUse can see the
 * file before the command runs; afterwards create vs overwrite is unknowable, so PostToolUse gets bare
 * file writes. Scratch files outside the repo are left out: they are nobody else's work.
 * Writes of unknown content stay `write`, so captured logs never read as duplicated work.
 */
export async function bashWrites(
  command: string,
  cwd: string,
  repoRoot: string,
  phase: Phase,
): Promise<FileChange & { files: string[] }> {
  const byPath = new Map<string, Written>();
  for (const w of shellWrites(command)) {
    const { abs, rel } = repoPath(w.path, cwd, repoRoot);
    if (isAbsolute(rel)) continue;
    const seen = byPath.get(abs);
    const before = seen ? seen.before : phase === "pre" ? readOrNull(abs) : null;
    const start = seen ? seen.text : phase === "pre" ? before : undefined;
    byPath.set(abs, { rel, before, text: apply(start, w.append, w.content) });
  }
  const out = { files: [] as string[], touches: [] as FileChange["touches"], references: [] as string[] };
  for (const f of byPath.values()) {
    const after = phase === "pre" && f.text !== undefined ? f.text : null;
    // Only authored text counts as a create; `npm test > out.log` captures output, it does not build a file.
    const created = after !== null && f.before === null;
    const change = await fileChange(f.rel, f.before, after, created, repoRoot);
    out.files.push(f.rel);
    out.touches.push(...change.touches);
    out.references.push(...change.references.filter((r) => !out.references.includes(r)));
  }
  return out;
}
