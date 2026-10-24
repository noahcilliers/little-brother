import { z } from "zod";

export const MAX_GRAPH_EDGES = 5000;
export const MAX_GRAPH_FILES = 20_000;

/**
 * One-hop dependency map of a repo, sent with SessionStart. Keys are `file::name` (a symbol other files
 * import by name) or `file::*` (the module imported as a whole); each maps to indexes into `files`, the
 * files that import it. Names and paths only, never code.
 */
export const RepoGraph = z.object({
  v: z.literal(1),
  head: z.string().max(64), // HEAD sha the graph was built at
  hash: z.string().max(64), // content hash: the backend rewrites its copy only when this changes
  files: z.array(z.string().max(500)).max(MAX_GRAPH_FILES),
  edges: z
    .array(z.tuple([z.string().max(600), z.array(z.number().int().nonnegative())]))
    .max(MAX_GRAPH_EDGES),
});
export type RepoGraph = z.infer<typeof RepoGraph>;

/** Importer files of one interface change, attached to the node that made it. */
export const ImporterLink = z.object({
  symbol: z.string(), // the changed symbol, as the touch names it
  files: z.array(z.string()),
  via: z.enum(["symbol", "module"]), // imported by name, or only the module as a whole
});
export type ImporterLink = z.infer<typeof ImporterLink>;

const keyFile = (key: string): string => key.slice(0, key.lastIndexOf("::"));

/**
 * Inverts per-file import keys into key → importers and keeps the most-imported keys until the edge budget
 * is spent, so a capped graph still covers the symbols with the widest blast radius. Self-imports are dropped.
 */
export function buildRepoGraph(
  importsByFile: Map<string, Iterable<string>>,
  head: string,
  hash: (text: string) => string,
  maxEdges = MAX_GRAPH_EDGES,
): RepoGraph {
  const byKey = new Map<string, Set<string>>();
  for (const [file, keys] of importsByFile) {
    for (const key of keys) {
      if (keyFile(key) === file) continue;
      let set = byKey.get(key);
      if (!set) {
        set = new Set();
        byKey.set(key, set);
      }
      set.add(file);
    }
  }
  const ranked = [...byKey.entries()].sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1));
  const files: string[] = [];
  const index = new Map<string, number>();
  const edges: RepoGraph["edges"] = [];
  let budget = maxEdges;
  for (const [key, importers] of ranked) {
    if (budget <= 0 || edges.length >= MAX_GRAPH_EDGES) break;
    const ids: number[] = [];
    for (const f of [...importers].sort().slice(0, budget)) {
      let i = index.get(f);
      if (i === undefined) {
        i = files.length;
        index.set(f, i);
        files.push(f);
      }
      ids.push(i);
    }
    budget -= ids.length;
    edges.push([key, ids]);
  }
  const body = JSON.stringify([files, edges]);
  return { v: 1, head, hash: hash(body), files, edges };
}

/**
 * Graph keys to look up for a changed symbol: the symbol itself and its owners (a changed method matters to
 * files importing its class) by name, then the module as a whole.
 */
export function graphKeysFor(symbol: string): { key: string; via: ImporterLink["via"] }[] {
  const i = symbol.lastIndexOf("::");
  if (i < 0) return [];
  const file = symbol.slice(0, i);
  const parts = symbol.slice(i + 2).split(".");
  const out: { key: string; via: ImporterLink["via"] }[] = [];
  for (let k = parts.length; k > 0; k--)
    out.push({ key: `${file}::${parts.slice(0, k).join(".")}`, via: "symbol" });
  out.push({ key: `${file}::*`, via: "module" });
  return out;
}
