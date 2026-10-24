import type { PyParsed } from "./py-defs";
import type { PyImport } from "./py-imports";
import type { PyResolver, PyTarget } from "./py-resolve";
import { intersects, type Span } from "./spans";

const TOKEN = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g;
const DECL_BEFORE = /(?:def|class)\s+$/;
const MAX_REFS = 200;

export type PyRefInput = {
  path: string;
  parsed: PyParsed;
  imports: PyImport[];
  resolver: PyResolver;
  region: Span;
};

function bindings(imports: PyImport[], path: string, resolver: PyResolver): Map<string, PyTarget> {
  const out = new Map<string, PyTarget>();
  for (const imp of imports) {
    const t = resolver.target(imp, path);
    if (t) out.set(imp.local, t);
  }
  return out;
}

/** Longest imported prefix of a dotted chain: `helpers.format_name` → (helpers, "format_name"). */
function resolveChain(chain: string, bound: Map<string, PyTarget>, resolver: PyResolver): string | null {
  const parts = chain.split(".");
  for (let k = parts.length; k > 0; k--) {
    const t = bound.get(parts.slice(0, k).join("."));
    if (!t) continue;
    const rest = parts.slice(k).join(".");
    if (t.kind === "symbol") return rest ? `${t.key}.${rest}` : t.key;
    if (!rest) return null;
    const [first = "", ...more] = rest.split(".");
    const key = resolver.symbol(t.file, first);
    return more.length ? `${key}.${more.join(".")}` : key;
  }
  return null;
}

function expandToLines(text: string, span: Span): Span {
  const start = text.lastIndexOf("\n", Math.max(0, span.start - 1)) + 1;
  const nl = text.indexOf("\n", span.end);
  return { start, end: nl < 0 ? text.length : nl };
}

/**
 * Symbols the changed region uses: imported names (resolved to `file::name` through the imports visible in
 * the file), calls to this file's own top-level defs, and `self.method(` calls inside a class.
 */
export function pythonReferences(p: PyRefInput): string[] {
  const { masked, defs } = p.parsed;
  const bound = bindings(p.imports, p.path, p.resolver);
  const topLevel = new Set(defs.filter((d) => !d.qualname.includes(".")).map((d) => d.qualname));
  const classes = defs.filter((d) => d.kind === "class");
  const region = expandToLines(masked, p.region);
  const importSpans = p.imports.map((i) => i.span);
  const refs = new Set<string>();
  const text = masked.slice(region.start, region.end);
  for (const m of text.matchAll(TOKEN)) {
    const at = region.start + (m.index ?? 0);
    const prev = masked[at - 1] ?? " ";
    if (prev === "." || /\w/.test(prev)) continue;
    if (DECL_BEFORE.test(masked.slice(Math.max(0, at - 8), at))) continue;
    const span = { start: at, end: at + m[0].length };
    if (importSpans.some((s) => intersects(span, s))) continue;
    const called = /^\s*\(/.test(masked.slice(span.end, span.end + 8));
    const chain = m[0];
    const head = chain.split(".")[0] ?? "";
    const imported = resolveChain(chain, bound, p.resolver);
    if (imported) refs.add(imported);
    else if (called && topLevel.has(head)) refs.add(`${p.path}::${chain}`);
    else if (called && (head === "self" || head === "cls") && chain.includes(".")) {
      const owner = classes
        .filter((c) => c.span.start <= at && at <= c.span.end)
        .sort((a, b) => b.qualname.length - a.qualname.length)[0];
      const member = chain.split(".")[1];
      if (owner && member) refs.add(`${p.path}::${owner.qualname}.${member}`);
    }
    if (refs.size >= MAX_REFS) break;
  }
  return [...refs];
}
