import type { Touch } from "../ingest";
import { type PyDef, parsePython } from "./py-defs";
import { pythonImports } from "./py-imports";
import { pythonReferences } from "./py-refs";
import type { PyResolver } from "./py-resolve";
import { signatureBreaks } from "./py-signature";
import { changedSpans, clipSpan, intersects, lineRange, type Span } from "./spans";

export type SymbolDiff = { touches: Touch[]; references: string[] };

const parentOf = (q: string): string => (q.includes(".") ? q.slice(0, q.lastIndexOf(".")) : "");
const sigKey = (d: PyDef): string =>
  d.signature ? d.signature.params.map((p) => `${p.kind}:${p.name}:${p.required}`).join(",") : "";

const inside = (d: PyDef, o: PyDef): boolean => o !== d && d.qualname.startsWith(`${o.qualname}.`);

/** A created or deleted class covers its members, so only the outermost one is reported. */
function outermost(defs: PyDef[]): PyDef[] {
  return defs.filter((d) => !defs.some((o) => inside(d, o)));
}

/**
 * A def that disappears and one that appears in the same scope, with the same kind and parameters, is a
 * rename in place. Members of a renamed class move with it and are not reported again.
 */
function pairRenames(gone: PyDef[], added: PyDef[]): [PyDef, PyDef][] {
  const pairs: [PyDef, PyDef][] = [];
  const free = [...added];
  for (const d of gone) {
    const i = free.findIndex(
      (a) => parentOf(a.qualname) === parentOf(d.qualname) && a.kind === d.kind && sigKey(a) === sigKey(d),
    );
    const match = free[i];
    if (i < 0 || !match) continue;
    pairs.push([d, match]);
    free.splice(i, 1);
  }
  return pairs;
}

/** Symbol touches and references for one Python file edit. `oldText` null means the file is new. */
export function diffPython(
  path: string,
  oldText: string | null,
  newText: string,
  resolver: PyResolver,
): SymbolDiff {
  const spans = changedSpans(oldText ?? "", newText);
  const after = parsePython(newText);
  const before = oldText === null ? null : parsePython(oldText);
  const oldBy = new Map((before?.defs ?? []).map((d) => [d.qualname, d]));
  const newBy = new Map(after.defs.map((d) => [d.qualname, d]));
  const sym = (q: string): string => `${path}::${q}`;
  const touches: Touch[] = [];
  const at = (text: string, span: Span, clip?: Span): [number, number] =>
    lineRange(text, clip ? clipSpan(clip, span) : span);

  let gone = before ? before.defs.filter((d) => !newBy.has(d.qualname)) : [];
  let added = after.defs.filter((d) => !oldBy.has(d.qualname) && intersects(spans.new, d.span));
  const renames = before ? pairRenames(gone, added) : [];
  for (const [from, to] of renames) {
    const moved = (d: PyDef, root: string) => d.qualname === root || d.qualname.startsWith(`${root}.`);
    gone = gone.filter((d) => !moved(d, from.qualname));
    added = added.filter((d) => !moved(d, to.qualname));
    const lines = at(newText, to.span);
    touches.push({ path, symbol: sym(from.qualname), op: "rename", lines });
    touches.push({ path, symbol: sym(to.qualname), op: "create", lines });
  }

  const changed = after.defs.filter((d) => {
    const old = oldBy.get(d.qualname);
    if (!old || oldText === null || !intersects(spans.new, d.span)) return false;
    // Prefix/suffix trimming can graze a neighbour's header; an unchanged body is not a change.
    return oldText.slice(old.span.start, old.span.end) !== newText.slice(d.span.start, d.span.end);
  });
  const created = outermost(added);
  // An edited method is reported, not its class: editing one method is not editing the others.
  const reported = [...changed, ...created, ...renames.map(([, to]) => to)];
  const edited = changed.filter((d) => !reported.some((o) => inside(o, d)));
  for (const d of [...edited, ...created]) {
    const old = oldBy.get(d.qualname);
    const sigChanged = old?.signature && d.signature && signatureBreaks(old.signature, d.signature);
    const op: Touch["op"] = !old ? "create" : sigChanged ? "signature_change" : "write";
    touches.push({ path, symbol: sym(d.qualname), op, lines: at(newText, d.span, spans.new) });
  }
  for (const d of outermost(gone)) {
    if (oldText !== null)
      touches.push({ path, symbol: sym(d.qualname), op: "delete", lines: at(oldText, d.span) });
  }

  const references = pythonReferences({
    path,
    parsed: after,
    imports: pythonImports(after.lines),
    resolver,
    region: spans.new,
  });
  return { touches, references };
}
