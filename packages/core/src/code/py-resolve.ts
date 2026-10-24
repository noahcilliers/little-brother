import { type PyImport, pythonImports } from "./py-imports";
import { logicalLines, maskPython } from "./py-lex";

/** Read-only view of the repo, injected so resolution stays pure: paths are repo-relative POSIX. */
export type RepoFs = { exists(rel: string): boolean; read(rel: string): string | null };

/** Where an imported local name points: a module (namespace), one symbol key, or nothing in the repo. */
export type PyTarget = { kind: "module"; file: string } | { kind: "symbol"; key: string };

const dirOf = (p: string): string => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const joinPath = (a: string, b: string): string => (a && b ? `${a}/${b}` : a || b);
const MAX_REEXPORT_HOPS = 3;

export type PyResolver = {
  /** File of a module imported from `fromFile`; guesses an in-repo path for relative imports. */
  moduleFile(module: string, level: number, fromFile: string, guess?: boolean): string | null;
  target(imp: PyImport, fromFile: string): PyTarget | null;
  /** Key for `module.name` access, following a package `__init__` re-export to the defining file. */
  symbol(file: string, name: string): string;
};

/** Resolver with per-instance caches, so a graph build reads and parses each `__init__.py` once. */
export function pyResolver(fs: RepoFs): PyResolver {
  const exists = new Map<string, boolean>();
  const has = (rel: string): boolean => {
    let v = exists.get(rel);
    if (v === undefined) {
      v = fs.exists(rel);
      exists.set(rel, v);
    }
    return v;
  };
  const importsOf = new Map<string, PyImport[]>();
  const sources = new Map<string, string | null>();
  const source = (file: string): string | null => {
    if (!sources.has(file)) sources.set(file, fs.read(file));
    return sources.get(file) ?? null;
  };

  /** sys.path guesses: the importing file's top package parent, the repo root and `src/`. */
  const roots = (fromFile: string): string[] => {
    let dir = dirOf(fromFile);
    while (dir && has(joinPath(dir, "__init__.py"))) dir = dirOf(dir);
    return [...new Set([dir, "", "src"])];
  };
  const fileAt = (base: string): string | null => {
    if (has(`${base}.py`)) return `${base}.py`;
    if (has(joinPath(base, "__init__.py"))) return joinPath(base, "__init__.py");
    return null;
  };

  const moduleFile: PyResolver["moduleFile"] = (module, level, fromFile, guess = true) => {
    const rel = module.replace(/\./g, "/");
    if (level > 0) {
      let base = dirOf(fromFile);
      for (let i = 1; i < level; i++) base = dirOf(base);
      const path = joinPath(base, rel);
      if (!rel) return joinPath(base, "__init__.py");
      return fileAt(path) ?? (guess ? `${path}.py` : null);
    }
    const all = roots(fromFile);
    for (const root of all) {
      const hit = fileAt(joinPath(root, rel));
      if (hit) return hit;
    }
    if (!guess) return null;
    // The package is ours but this module is not on disk yet: another agent may be creating it.
    const head = module.split(".")[0] ?? "";
    const root = all.find((r) => fileAt(joinPath(r, head)) !== null);
    return root === undefined || !module.includes(".") ? null : `${joinPath(root, rel)}.py`;
  };

  /** Follows `from .core import Command` in a package `__init__` so users of `pkg.Command` hit core.py. */
  const symbolKey = (file: string, name: string, hops: number): string => {
    // Only package inits are followed: that is where re-exports live, and it bounds reads on the hot path.
    const follow = hops < MAX_REEXPORT_HOPS && file.endsWith("__init__.py");
    const src = follow ? source(file) : null;
    if (src === null || new RegExp(`^(?:async\\s+def|def|class)\\s+${name}\\b`, "m").test(src))
      return `${file}::${name}`;
    let imps = importsOf.get(file);
    if (!imps) {
      imps = pythonImports(logicalLines(maskPython(src)));
      importsOf.set(file, imps);
    }
    const imp = imps.find((i) => i.local === name && i.name !== undefined && i.name !== "*");
    if (!imp) return `${file}::${name}`;
    const t = target(imp, file, hops + 1);
    return t?.kind === "symbol" ? t.key : `${file}::${name}`;
  };

  const target = (imp: PyImport, fromFile: string, hops = 0): PyTarget | null => {
    if (imp.name === "*") return null;
    if (imp.name === undefined) {
      const file = moduleFile(imp.module, imp.level, fromFile);
      return file ? { kind: "module", file } : null;
    }
    const sub = moduleFile(joinPath(imp.module, imp.name).replace(/\//g, "."), imp.level, fromFile, false);
    if (sub) return { kind: "module", file: sub };
    const file = moduleFile(imp.module, imp.level, fromFile);
    if (file) return { kind: "symbol", key: symbolKey(file, imp.name, hops) };
    return null;
  };

  return {
    moduleFile,
    target: (imp, fromFile) => target(imp, fromFile),
    symbol: (file, name) => symbolKey(file, name, 0),
  };
}
