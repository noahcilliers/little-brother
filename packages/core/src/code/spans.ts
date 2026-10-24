export type Span = { start: number; end: number };

/** Smallest region that differs, as spans in old and new text (common prefix/suffix trim). */
export function changedSpans(oldText: string, newText: string): { old: Span; new: Span } {
  const max = Math.min(oldText.length, newText.length);
  let pre = 0;
  while (pre < max && oldText.charCodeAt(pre) === newText.charCodeAt(pre)) pre++;
  let suf = 0;
  while (
    suf < max - pre &&
    oldText.charCodeAt(oldText.length - 1 - suf) === newText.charCodeAt(newText.length - 1 - suf)
  )
    suf++;
  return { old: { start: pre, end: oldText.length - suf }, new: { start: pre, end: newText.length - suf } };
}

export function lineAt(text: string, offset: number): number {
  let line = 1;
  const stop = Math.min(offset, text.length);
  for (let i = 0; i < stop; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

export function lineRange(text: string, span: Span): [number, number] {
  const a = lineAt(text, span.start);
  const endOffset = span.end > span.start ? span.end - 1 : span.start;
  return [a, Math.max(a, lineAt(text, endOffset))];
}

export function intersects(a: Span, b: Span): boolean {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  return a.start < b.end && b.start < a.end;
}

export function clipSpan(span: Span, to: Span): Span {
  const start = Math.max(span.start, to.start);
  return { start, end: Math.max(start, Math.min(span.end, to.end)) };
}
