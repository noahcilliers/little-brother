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

export function capLines(text: string, maxLines = 40, maxChars = 4000): string {
  const lines = text.split("\n");
  const head = lines.slice(0, maxLines).join("\n");
  return head.length > maxChars ? head.slice(0, maxChars) : head;
}

export function tailLines(text: string, maxLines = 20, maxChars = 2000): string {
  const lines = text.replace(/\s+$/, "").split("\n");
  const tail = lines.slice(-maxLines).join("\n");
  return tail.length > maxChars ? tail.slice(tail.length - maxChars) : tail;
}

type EditSpec = { old_string: string; new_string: string; replace_all?: boolean };

/** Applies Claude Code Edit/MultiEdit semantics; null when an old_string is missing. */
export function applyEdits(content: string, edits: EditSpec[]): string | null {
  let out = content;
  for (const e of edits) {
    if (e.old_string === "") {
      out = e.new_string + out;
      continue;
    }
    if (!out.includes(e.old_string)) return null;
    out = e.replace_all
      ? out.split(e.old_string).join(e.new_string)
      : out.replace(e.old_string, () => e.new_string);
  }
  return out;
}

/** Inverse of applyEdits, for PostToolUse where the file on disk already holds the new text. */
export function revertEdits(content: string, edits: EditSpec[]): string | null {
  const inverse = [...edits]
    .reverse()
    .map((e) => ({ old_string: e.new_string, new_string: e.old_string, replace_all: e.replace_all }));
  return applyEdits(content, inverse);
}
