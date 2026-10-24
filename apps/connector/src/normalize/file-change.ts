import type { Touch } from "@lb/core";
import { diffPythonFile, PYTHON } from "./py-symbols";
import { diffSymbols } from "./symbols";
import { changedSpans, lineRange } from "./text";
import { loadTs } from "./ts-symbols";

export type FileChange = { touches: Touch[]; references: string[] };

const JS_TS = /\.(c|m)?(t|j)sx?$/;
const MAX_PARSE_BYTES = 1_000_000;

/**
 * File-level touch plus symbol touches for one file. `before` null = the file did not exist; `after` null =
 * the new text is unknown, which leaves a bare file touch.
 */
export async function fileChange(
  rel: string,
  before: string | null,
  after: string | null,
  created: boolean,
  repoRoot: string,
): Promise<FileChange> {
  const fileTouch: Touch = { path: rel, op: created ? "create" : "write" };
  const known = after !== null && (created || before !== null);
  if (after !== null && known) fileTouch.lines = lineRange(after, changedSpans(before ?? "", after).new);
  const base: FileChange = { touches: [fileTouch], references: [] };
  if (!known || after === null || after.length > MAX_PARSE_BYTES) return base;
  try {
    if (PYTHON.test(rel)) {
      const diff = diffPythonFile(rel, created ? null : before, after, repoRoot);
      return { touches: [fileTouch, ...diff.touches], references: diff.references };
    }
    if (!JS_TS.test(rel)) return base;
    const ts = await loadTs();
    const diff = diffSymbols(ts, rel, created ? null : before, after, repoRoot);
    return { touches: [fileTouch, ...diff.touches], references: diff.references };
  } catch {
    return base;
  }
}
