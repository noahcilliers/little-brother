import type { Touch } from "@lb/core";
import { editTexts, type Phase } from "./edits";
import { repoPath } from "./paths";
import { diffSymbols } from "./symbols";
import { changedSpans, lineRange } from "./text";
import { generatedMatcher, loadTopicMap } from "./topic-map";
import { loadTs } from "./ts-symbols";

export type NormalizeInput = {
  tool: string;
  input: Record<string, unknown>;
  cwd: string;
  repoRoot: string;
  phase: Phase;
  toolResponse?: unknown;
};

export type Normalized = { files: string[]; touches: Touch[]; references: string[]; preview?: string };

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
const JS_TS = /\.(c|m)?(t|j)sx?$/;
const MAX_PARSE_BYTES = 1_000_000;

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

async function normalizeEdit(p: NormalizeInput, filePath: string): Promise<Normalized> {
  const { abs, rel } = repoPath(filePath, p.cwd, p.repoRoot);
  const t = editTexts(p.tool, p.input, abs, p.phase, p.toolResponse);
  const op: Touch["op"] = t.created ? "create" : "write";
  const fileTouch: Touch = { path: rel, op };
  const known = t.after !== null && (t.created || t.before !== null);
  if (t.after !== null && known)
    fileTouch.lines = lineRange(t.after, changedSpans(t.before ?? "", t.after).new);
  const base: Normalized = { files: [rel], touches: [fileTouch], references: [], preview: t.preview };
  if (!known || t.after === null || !JS_TS.test(rel) || t.after.length > MAX_PARSE_BYTES) return base;
  try {
    const ts = await loadTs();
    const diff = diffSymbols(ts, rel, t.created ? null : t.before, t.after, p.repoRoot);
    return { ...base, touches: [fileTouch, ...diff.touches], references: diff.references };
  } catch {
    return base;
  }
}

function normalizeRead(p: NormalizeInput): Normalized {
  const target = str(p.input.file_path) ?? str(p.input.path);
  if (!target) return { files: [], touches: [], references: [] };
  const { rel } = repoPath(target, p.cwd, p.repoRoot);
  return { files: [rel], touches: [{ path: rel, op: "read" }], references: [] };
}

/** Classifier step 1. Never throws: anything unexpected degrades to file-level touches or nothing. */
export async function normalizeTool(p: NormalizeInput): Promise<Normalized> {
  let out: Normalized = { files: [], touches: [], references: [] };
  try {
    const filePath = str(p.input.file_path);
    if (EDIT_TOOLS.has(p.tool) && filePath) out = await normalizeEdit(p, filePath);
    else if (READ_TOOLS.has(p.tool)) out = normalizeRead(p);
    else if (p.tool === "NotebookEdit" && str(p.input.notebook_path)) {
      const { rel } = repoPath(str(p.input.notebook_path) ?? "", p.cwd, p.repoRoot);
      out = { files: [rel], touches: [{ path: rel, op: "write" }], references: [] };
    }
    const isGenerated = generatedMatcher(loadTopicMap(p.repoRoot).generated);
    for (const t of out.touches) if (isGenerated(t.path)) t.generated = true;
  } catch {
    return out;
  }
  return out;
}
