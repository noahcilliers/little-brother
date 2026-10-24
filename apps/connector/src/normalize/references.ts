import { existsSync } from "node:fs";
import { join, posix } from "node:path";
import type * as TS from "typescript";
import { intersects, type Span } from "./text";
import type { TsModule } from "./ts-symbols";

type Imported = { module: string; name: string };

const EXTS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];

/** Relative specifiers become repo-relative paths so references line up with other agents' touches. */
function resolveModule(spec: string, fileRel: string, repoRoot: string): string {
  if (!spec.startsWith(".")) return spec;
  const base = posix.normalize(posix.join(posix.dirname(fileRel), spec));
  for (const ext of EXTS) if (existsSync(join(repoRoot, base + ext))) return base + ext;
  return base.replace(/\.js$/, ".ts");
}

function importMap(
  ts: TsModule,
  sf: TS.SourceFile,
  fileRel: string,
  repoRoot: string,
): Map<string, Imported> {
  const map = new Map<string, Imported>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const module = resolveModule(st.moduleSpecifier.text, fileRel, repoRoot);
    const clause = st.importClause;
    if (!clause) continue;
    if (clause.name) map.set(clause.name.text, { module, name: "default" });
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) map.set(nb.name.text, { module, name: "*" });
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements)
        map.set(el.name.text, { module, name: (el.propertyName ?? el.name).text });
    }
  }
  return map;
}

/** Imported identifiers and called functions inside the changed region. */
export function referencesIn(
  ts: TsModule,
  sf: TS.SourceFile,
  region: Span,
  fileRel: string,
  repoRoot: string,
  localDecls: Set<string>,
): string[] {
  const imports = importMap(ts, sf, fileRel, repoRoot);
  const refs = new Set<string>();
  const qualify = (name: string): string => {
    const imp = imports.get(name);
    if (imp) return `${imp.module}::${imp.name === "default" || imp.name === "*" ? name : imp.name}`;
    if (localDecls.has(name)) return `${fileRel}::${name}`;
    return name;
  };
  const visit = (node: TS.Node): void => {
    if (ts.isImportDeclaration(node)) return;
    if (!intersects({ start: node.getStart(sf), end: node.getEnd() }, region)) return;
    if (ts.isIdentifier(node) && imports.has(node.text)) refs.add(qualify(node.text));
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) refs.add(qualify(callee.text));
      else if (ts.isPropertyAccessExpression(callee)) {
        const ns = ts.isIdentifier(callee.expression) ? imports.get(callee.expression.text) : undefined;
        refs.add(ns?.name === "*" ? `${ns.module}::${callee.name.text}` : callee.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return [...refs];
}
