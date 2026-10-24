import type { LogicalLine } from "./py-lex";
import { splitTopLevel } from "./py-signature";
import type { Span } from "./spans";

/**
 * One name an import statement binds. `name` absent = the module itself (`import a.b`, `import a.b as z`);
 * `name` "*" = a star import. `level` counts the leading dots of a relative import.
 */
export type PyImport = { local: string; module: string; level: number; name?: string; span: Span };

const IMPORT = /^import\s+([\s\S]+)$/;
const FROM = /^from\s+(\.*)\s*([\w.]*)\s+import\s+([\s\S]+)$/;
const ALIAS = /^([\w.]+)(?:\s+as\s+(\w+))?$/;

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Import statements anywhere in the file, including function-local ones. */
export function pythonImports(lines: LogicalLine[]): PyImport[] {
  const out: PyImport[] = [];
  for (const line of lines) {
    const span = { start: line.start, end: line.end };
    const text = squash(line.text.replace(/\\\n/g, " "));
    const plain = IMPORT.exec(text);
    if (plain?.[1]) {
      for (const part of splitTopLevel(plain[1])) {
        const m = ALIAS.exec(part.trim());
        if (!m?.[1]) continue;
        // `import a.b` binds `a`, but code then spells the full chain, so the chain is the useful key.
        out.push({ local: m[2] ?? m[1], module: m[1], level: 0, span });
      }
      continue;
    }
    const from = FROM.exec(text);
    if (!from) continue;
    const level = from[1]?.length ?? 0;
    const module = from[2] ?? "";
    const names = (from[3] ?? "").replace(/^\(|\)$/g, "");
    for (const part of splitTopLevel(names)) {
      const p = part.trim();
      if (p === "*") {
        out.push({ local: "*", module, level, name: "*", span });
        continue;
      }
      const m = ALIAS.exec(p);
      if (m?.[1]) out.push({ local: m[2] ?? m[1], module, level, name: m[1], span });
    }
  }
  return out;
}
