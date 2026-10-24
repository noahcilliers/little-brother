import { pythonImports } from "./py-imports";
import { logicalLines, maskPython } from "./py-lex";
import type { PyResolver } from "./py-resolve";

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Repo graph keys one Python file imports. A module imported whole (`import helpers`, `from . import
 * utils`) is narrowed to the attributes the file actually uses (`helpers.format_name` → helpers.py::
 * format_name); a module used without attribute access, or star-imported, stays a module-level key.
 */
export function pythonImportKeys(path: string, src: string, resolver: PyResolver): Set<string> {
  const masked = maskPython(src);
  const keys = new Set<string>();
  for (const imp of pythonImports(logicalLines(masked))) {
    if (imp.name === "*") {
      const file = resolver.moduleFile(imp.module, imp.level, path, false);
      if (file) keys.add(`${file}::*`);
      continue;
    }
    const t = resolver.target(imp, path);
    if (!t) continue;
    if (t.kind === "symbol") {
      keys.add(t.key);
      continue;
    }
    let used = false;
    for (const m of masked.matchAll(
      new RegExp(`(?<![\\w.])${escapeRegex(imp.local)}\\.([A-Za-z_]\\w*)`, "g"),
    )) {
      if (!m[1]) continue;
      keys.add(resolver.symbol(t.file, m[1]));
      used = true;
    }
    if (!used) keys.add(`${t.file}::*`);
  }
  return keys;
}
