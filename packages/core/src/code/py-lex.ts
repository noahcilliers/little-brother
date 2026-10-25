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

/** Whether the string opening at `i` has an f prefix (f, rf, Fr …): its `{…}` parts are code. */
function isFString(src: string, i: number): boolean {
  let k = i - 1;
  let prefix = "";
  while (k >= 0 && /[rRbBfFuU]/.test(src[k] ?? "")) prefix = src[k--] + prefix;
  return prefix.length > 0 && prefix.length <= 2 && !/\w/.test(src[k] ?? "") && /f/i.test(prefix);
}

/**
 * Literal ranges of an f-string body [open, end): everything except the replacement fields' code, and except
 * strings nested inside that code. `{{` is a literal brace.
 */
function fStringLiterals(src: string, open: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  let from = open;
  let depth = 0;
  let j = open;
  while (j < end) {
    const c = src[j];
    if (depth === 0) {
      if (c === "{" && src[j + 1] === "{") j += 2;
      else if (c === "{") {
        out.push([from, j]);
        depth = 1;
        j++;
      } else j++;
      continue;
    }
    if (c === '"' || c === "'") {
      const close = src.indexOf(c, j + 1);
      const stop = close < 0 || close > end ? end : close;
      out.push([j + 1, stop]);
      j = stop + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) from = j + 1;
    j++;
  }
  out.push([depth === 0 ? from : end, end]);
  return out;
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
      // Calls inside f-string fields are real uses (`f"{slugify(name)}.txt"`); only the literal text is blanked.
      if (isFString(src, i)) for (const [from, to] of fStringLiterals(src, open, end)) blank(from, to);
      else blank(open, end);
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
