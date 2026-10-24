import type * as TS from "typescript";
import type { Span } from "./text";

export type TsModule = typeof TS;

export type Decl = {
  name: string;
  span: Span;
  exported: boolean;
  /** Parameter list + return type text; only for functions, so signature_change can compare it. */
  signature?: string;
};

let cached: TsModule | null = null;

/** typescript is ~9 MB, so it loads only when a JS/TS edit actually needs parsing. */
export async function loadTs(): Promise<TsModule> {
  if (!cached) {
    const mod = (await import("typescript")) as unknown as { default?: TsModule } & TsModule;
    cached = mod.default ?? mod;
  }
  return cached;
}

export function parse(ts: TsModule, fileName: string, text: string): TS.SourceFile {
  const kind = /\.tsx$|\.jsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
}

function isExported(ts: TsModule, node: TS.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function fnSignature(
  sf: TS.SourceFile,
  fn: { parameters: TS.NodeArray<TS.ParameterDeclaration>; type?: TS.TypeNode },
): string {
  // Names are left out on purpose: renaming `_user` to `user` does not break any caller.
  const params = fn.parameters
    .map((p) => {
      const type = p.type ? p.type.getText(sf).replace(/\s+/g, " ") : "?";
      return `${p.dotDotDotToken ? "..." : ""}${p.questionToken || p.initializer ? "opt " : ""}${type}`;
    })
    .join(", ");
  return `(${params}): ${fn.type ? fn.type.getText(sf).replace(/\s+/g, " ") : ""}`;
}

export function topLevelDecls(ts: TsModule, sf: TS.SourceFile): Decl[] {
  const out: Decl[] = [];
  for (const st of sf.statements) {
    const span = { start: st.getStart(sf), end: st.getEnd() };
    const exported = isExported(ts, st);
    if (ts.isFunctionDeclaration(st)) {
      out.push({ name: st.name?.text ?? "default", span, exported, signature: fnSignature(sf, st) });
    } else if (
      ts.isClassDeclaration(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isEnumDeclaration(st)
    ) {
      out.push({ name: st.name?.text ?? "default", span, exported });
    } else if (ts.isVariableStatement(st) && exported) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const init = d.initializer;
        const signature =
          init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
            ? fnSignature(sf, init)
            : undefined;
        const own =
          st.declarationList.declarations.length === 1 ? span : { start: d.getStart(sf), end: d.getEnd() };
        out.push({ name: d.name.text, span: own, exported, signature });
      }
    }
  }
  return out;
}
