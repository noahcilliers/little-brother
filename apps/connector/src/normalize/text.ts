// Span math lives in core so the Python normalizer (pure, in core) and the TS one share it.
export { changedSpans, intersects, lineAt, lineRange, type Span } from "@lb/core";

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
