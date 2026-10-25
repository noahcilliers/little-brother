import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { capText, resolveInside } from "./paths";
import type { ToolOutcome } from "./types";

const MAX_READ_LINES = 2000;
const MAX_LINE = 2000;
const MAX_READ_CHARS = 60_000;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const fail = (text: string): ToolOutcome => ({ ok: false, text, response: { error: text } });

/** Like Claude Code's Read: `cat -n` numbering, so the model can quote exact lines back in an Edit. */
export function readTool(cwd: string, input: Record<string, unknown>): ToolOutcome {
  const abs = resolveInside(cwd, str(input.file_path));
  if (!existsSync(abs)) return fail(`File does not exist: ${relative(cwd, abs)}`);
  if (statSync(abs).isDirectory())
    return fail(`${relative(cwd, abs)} is a directory; use Glob to list files.`);
  const content = readFileSync(abs, "utf8");
  const lines = content.split("\n");
  const start = Math.max(1, Math.floor(Number(input.offset) || 1));
  const count = Math.max(1, Math.floor(Number(input.limit) || MAX_READ_LINES));
  const shown = lines.slice(start - 1, start - 1 + count);
  const numbered = shown
    .map(
      (l, i) => `${String(start + i).padStart(6)}\t${l.length > MAX_LINE ? `${l.slice(0, MAX_LINE)}…` : l}`,
    )
    .join("\n");
  const more =
    start - 1 + shown.length < lines.length ? `\n… ${lines.length} lines total; use offset to read more` : "";
  const text = content.length === 0 ? "(empty file)" : capText(numbered, MAX_READ_CHARS) + more;
  return {
    ok: true,
    text,
    response: {
      type: "text",
      file: {
        filePath: abs,
        content: shown.join("\n"),
        numLines: shown.length,
        startLine: start,
        totalLines: lines.length,
      },
    },
  };
}

/** `type` and `originalFile` are what the connector's normalizer reads from Claude Code's Write response. */
export function writeTool(cwd: string, input: Record<string, unknown>): ToolOutcome {
  const abs = resolveInside(cwd, str(input.file_path));
  const content = str(input.content);
  const original = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  const rel = relative(cwd, abs);
  return {
    ok: true,
    text: original === null ? `Created ${rel}` : `Updated ${rel}`,
    response: {
      type: original === null ? "create" : "update",
      filePath: abs,
      content,
      originalFile: original,
    },
  };
}

const count = (hay: string, needle: string): number => (needle ? hay.split(needle).length - 1 : 0);

export function editTool(cwd: string, input: Record<string, unknown>): ToolOutcome {
  const abs = resolveInside(cwd, str(input.file_path));
  const rel = relative(cwd, abs);
  const oldString = str(input.old_string);
  const newString = str(input.new_string);
  const all = input.replace_all === true;
  if (!existsSync(abs)) return fail(`File does not exist: ${rel}. Use Write to create it.`);
  if (oldString === newString) return fail("old_string and new_string are identical; nothing to change.");
  const original = readFileSync(abs, "utf8");
  const n = count(original, oldString);
  if (n === 0)
    return fail(
      `old_string not found in ${rel}. Read the file and copy the exact text, whitespace included.`,
    );
  if (n > 1 && !all)
    return fail(
      `old_string occurs ${n} times in ${rel}. Add surrounding lines to make it unique, or set replace_all.`,
    );
  const updated = all
    ? original.split(oldString).join(newString)
    : original.replace(oldString, () => newString);
  writeFileSync(abs, updated);
  return {
    ok: true,
    text: `Edited ${rel}${all && n > 1 ? ` (${n} replacements)` : ""}`,
    response: {
      filePath: abs,
      oldString,
      newString,
      originalFile: original,
      replaceAll: all,
      structuredPatch: [],
    },
  };
}
