import type { Touch } from "@lb/core";
import { referencesIn } from "./references";
import { changedSpans, intersects, lineRange, type Span } from "./text";
import { type Decl, parse, type TsModule, topLevelDecls } from "./ts-symbols";

export type SymbolDiff = { touches: Touch[]; references: string[] };

function clip(span: Span, to: Span): Span {
  const start = Math.max(span.start, to.start);
  return { start, end: Math.max(start, Math.min(span.end, to.end)) };
}

/** Symbol-level touches for one JS/TS file edit. `oldText` null means the file is new. */
export function diffSymbols(
  ts: TsModule,
  path: string,
  oldText: string | null,
  newText: string,
  repoRoot: string,
): SymbolDiff {
  const spans = changedSpans(oldText ?? "", newText);
  const newSf = parse(ts, path, newText);
  const newDecls = topLevelDecls(ts, newSf);
  const oldDecls: Decl[] = oldText === null ? [] : topLevelDecls(ts, parse(ts, path, oldText));
  const oldByName = new Map(oldDecls.map((d) => [d.name, d]));
  const newNames = new Set(newDecls.map((d) => d.name));
  const touches: Touch[] = [];

  for (const d of newDecls) {
    if (!intersects(spans.new, d.span)) continue;
    const before = oldByName.get(d.name);
    const op: Touch["op"] = !before
      ? "create"
      : d.exported && d.signature !== undefined && before.signature !== d.signature
        ? "signature_change"
        : "write";
    touches.push({
      path,
      symbol: `${path}::${d.name}`,
      op,
      lines: lineRange(newText, clip(spans.new, d.span)),
    });
  }
  for (const d of oldDecls) {
    if (newNames.has(d.name) || oldText === null) continue;
    touches.push({ path, symbol: `${path}::${d.name}`, op: "delete", lines: lineRange(oldText, d.span) });
  }

  const references = referencesIn(ts, newSf, spans.new, path, repoRoot, newNames);
  return { touches, references };
}
