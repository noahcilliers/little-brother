import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRepoGraph, pyResolver, pythonImportKeys, type RepoFs, type RepoGraph } from "@lb/core";
import { sha1 } from "../hash";
import { loadTs } from "../normalize/ts-symbols";
import { sourceFiles } from "./files";
import { tsImportKeys } from "./ts-imports";

const MAX_FILE_BYTES = 1_000_000;

function readOrNull(abs: string): string | null {
  try {
    const text = readFileSync(abs, "utf8");
    return text.length > MAX_FILE_BYTES ? null : text;
  } catch {
    return null;
  }
}

/** Builds the one-hop import graph of the checkout at `root`. Runs in a detached child, never in a hook. */
export async function buildGraphFor(root: string, head: string): Promise<RepoGraph> {
  const files = sourceFiles(root);
  const known = new Set(files);
  const texts = new Map<string, string | null>();
  const read = (rel: string): string | null => {
    if (!texts.has(rel)) texts.set(rel, known.has(rel) ? readOrNull(join(root, rel)) : null);
    return texts.get(rel) ?? null;
  };
  const fs: RepoFs = { exists: (rel) => known.has(rel), read };
  const resolver = pyResolver(fs);
  const hasTs = files.some((f) => !/\.pyi?$/.test(f));
  const ts = hasTs ? await loadTs() : null;
  const imports = new Map<string, Set<string>>();
  for (const f of files) {
    const text = read(f);
    if (text === null) continue;
    try {
      if (/\.pyi?$/.test(f)) imports.set(f, pythonImportKeys(f, text, resolver));
      else if (ts) imports.set(f, tsImportKeys(ts, f, text, root, known));
    } catch {
      // one unparsable file must not cost the whole graph
    }
  }
  return buildRepoGraph(imports, head, (body) => sha1(body).slice(0, 16));
}
