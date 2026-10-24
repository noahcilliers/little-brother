import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { diffPython, pyResolver, type RepoFs, type SymbolDiff } from "@lb/core";

export const PYTHON = /\.pyi?$/;

/** Disk-backed view of the checkout, for import resolution. */
export function diskFs(repoRoot: string): RepoFs {
  return {
    exists: (rel) => existsSync(join(repoRoot, rel)),
    read: (rel) => {
      try {
        return readFileSync(join(repoRoot, rel), "utf8");
      } catch {
        return null;
      }
    },
  };
}

/**
 * Python symbol touches: a tokenizer pass in-process, no interpreter spawn on the hook path. A fresh
 * resolver per call, since `lb replay` writes files between calls in one process.
 */
export function diffPythonFile(
  rel: string,
  before: string | null,
  after: string,
  repoRoot: string,
): SymbolDiff {
  return diffPython(rel, before, after, pyResolver(diskFs(repoRoot)));
}
