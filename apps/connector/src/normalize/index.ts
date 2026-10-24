import type { Touch } from "@lb/core";
import { bashWrites } from "./bash";
import { editTexts, type Phase } from "./edits";
import { fileChange } from "./file-change";
import { repoPath } from "./paths";
import { generatedMatcher, loadTopicMap } from "./topic-map";

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

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

async function normalizeEdit(p: NormalizeInput, filePath: string): Promise<Normalized> {
  const { abs, rel } = repoPath(filePath, p.cwd, p.repoRoot);
  const t = editTexts(p.tool, p.input, abs, p.phase, p.toolResponse);
  const change = await fileChange(rel, t.before, t.after, t.created, p.repoRoot);
  return { files: [rel], ...change, preview: t.preview };
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
    else if (p.tool === "Bash" && str(p.input.command))
      out = await bashWrites(str(p.input.command) ?? "", p.cwd, p.repoRoot, p.phase);
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
