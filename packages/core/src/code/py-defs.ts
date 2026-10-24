import { type LogicalLine, logicalLines, maskPython } from "./py-lex";
import { closingBracket, type PySignature, parseParams, parseReturns } from "./py-signature";
import type { Span } from "./spans";

/** A function or class callers can reach: module level, or nested only inside classes. */
export type PyDef = {
  qualname: string; // "Class.method"
  kind: "def" | "class";
  /** From the first decorator to the end of the body. */
  span: Span;
  signature?: PySignature;
};

export type PyParsed = { masked: string; lines: LogicalLine[]; defs: PyDef[] };

const DEF = /^(async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
const CLASS = /^class\s+([A-Za-z_]\w*)/;

type Scope = { indent: number; qualname: string; kind: "def" | "class"; hidden: boolean; def?: PyDef };

function signatureOf(text: string, async: boolean, openParen: number): PySignature | undefined {
  const close = closingBracket(text, openParen);
  if (close < 0) return undefined;
  return {
    params: parseParams(text.slice(openParen + 1, close)),
    returns: parseReturns(text.slice(close + 1)),
    async,
  };
}

/**
 * Indentation-scoped scan of logical lines. Functions nested in functions are part of their parent's body,
 * not separate symbols, since nothing outside can call them.
 */
export function pythonDefs(lines: LogicalLine[]): PyDef[] {
  const out: PyDef[] = [];
  const stack: Scope[] = [];
  let decorator: number | null = null;
  for (const line of lines) {
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= line.indent) stack.pop();
    for (const s of stack) if (s.def) s.def.span.end = line.end;
    if (line.text.startsWith("@")) {
      decorator ??= line.start;
      continue;
    }
    const fn = DEF.exec(line.text);
    const cls = fn ? null : CLASS.exec(line.text);
    const name = fn?.[2] ?? cls?.[1];
    if (name) {
      const parent = stack[stack.length - 1];
      const hidden = parent !== undefined && (parent.kind === "def" || parent.hidden);
      const qualname = parent ? `${parent.qualname}.${name}` : name;
      const kind = fn ? "def" : "class";
      const def: PyDef | undefined = hidden
        ? undefined
        : { qualname, kind, span: { start: decorator ?? line.start, end: line.end } };
      if (def && fn) {
        const sig = signatureOf(line.text, fn[1] !== undefined, fn[0].length - 1);
        if (sig) def.signature = sig;
      }
      if (def) out.push(def);
      stack.push({ indent: line.indent, qualname, kind, hidden, def });
    }
    decorator = null;
  }
  return out;
}

export function parsePython(src: string): PyParsed {
  const masked = maskPython(src);
  const lines = logicalLines(masked);
  return { masked, lines, defs: pythonDefs(lines) };
}
