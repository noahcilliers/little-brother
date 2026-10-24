/** One Python logical line: physical lines joined by brackets or a trailing backslash. */
export type LogicalLine = { start: number; end: number; indent: number; text: string };

const HASH = 35;
const NEWLINE = 10;
const BACKSLASH = 92;

function stringEnd(src: string, i: number, quote: string, triple: boolean): number {
  const close = triple ? quote.repeat(3) : quote;
  let j = i;
  while (j < src.length) {
    const c = src.charCodeAt(j);
    if (c === BACKSLASH) {
      j += 2;
      continue;
    }
    if (!triple && c === NEWLINE) return j;
    if (src.startsWith(close, j)) return j;
    j++;
  }
  return src.length;
}

/**
 * Same-length copy of the source with comments and string contents blanked, so offsets still map to the
 * original while brackets, `#` and quotes inside strings can no longer confuse the line and token scans.
 * Newlines inside triple-quoted strings become spaces, which keeps the string inside one logical line.
 */
export function maskPython(src: string): string {
  const parts: string[] = [];
  let last = 0;
  let i = 0;
  const blank = (from: number, to: number): void => {
    parts.push(src.slice(last, from), " ".repeat(Math.max(0, to - from)));
    last = to;
  };
  while (i < src.length) {
    const c = src.charCodeAt(i);
    if (c === HASH) {
      const nl = src.indexOf("\n", i);
      const end = nl < 0 ? src.length : nl;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === 34 || c === 39) {
      const quote = src[i] ?? '"';
      const triple = src.startsWith(quote.repeat(3), i);
      const open = i + (triple ? 3 : 1);
      const end = stringEnd(src, open, quote, triple);
      blank(open, end);
      const closed = end < src.length && src.charCodeAt(end) !== NEWLINE;
      i = closed ? end + (triple ? 3 : 1) : end;
      continue;
    }
    i++;
  }
  parts.push(src.slice(last));
  return parts.join("");
}

const TOP_LEVEL_DECL = /^(?:def |class |async def |@)/;

const isBlank = (c: number): boolean => c === 32 || c === 9 || c === 13 || c === 12;

/** Splits masked source into logical lines; blank and comment-only lines are dropped. */
export function logicalLines(masked: string): LogicalLine[] {
  const out: LogicalLine[] = [];
  let depth = 0;
  let start = -1;
  let indent = 0;
  let lineStart = 0;
  const push = (endAt: number): void => {
    let end = endAt;
    while (end > start && isBlank(masked.charCodeAt(end - 1))) end--;
    out.push({ start, end, indent, text: masked.slice(start, end) });
    start = -1;
  };
  for (let i = 0; i < masked.length; i++) {
    const c = masked.charCodeAt(i);
    if (start < 0) {
      if (isBlank(c)) continue;
      if (c === NEWLINE) {
        lineStart = i + 1;
        continue;
      }
      start = i;
      indent = i - lineStart;
      depth = 0;
    }
    if (c === 40 || c === 91 || c === 123) depth++;
    else if (c === 41 || c === 93 || c === 125) depth = Math.max(0, depth - 1);
    else if (c === NEWLINE) {
      lineStart = i + 1;
      const prev = masked.charCodeAt(i - 1) === 13 ? i - 2 : i - 1;
      // An unclosed bracket (mid-edit code) must not swallow the rest of the file: a column-0 def ends it.
      const recover = depth > 0 && TOP_LEVEL_DECL.test(masked.slice(i + 1, i + 12));
      if (!recover && (depth > 0 || masked.charCodeAt(prev) === BACKSLASH)) continue;
      push(i);
    }
  }
  if (start >= 0) push(masked.length);
  return out;
}
