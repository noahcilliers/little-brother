import type { Touch } from "@lb/core";
import { bashWrites } from "./bash";
import { changesSince, snapshotBefore } from "./bash-snapshot";
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
  /** tool_use_id: pairs a Bash command's pre-run snapshot with its post-run diff. */
  snapshotKey?: string;
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

/**
 * Bash: redirects parsed from the command (visible before it runs), plus, after it ran, every file it actually
 * changed per the working-tree snapshot, which catches inline scripts and `sed -i`.
 */
async function normalizeBash(p: NormalizeInput): Promise<Normalized> {
  const parsed = await bashWrites(str(p.input.command) ?? "", p.cwd, p.repoRoot, p.phase);
  if (!p.snapshotKey) return parsed;
  if (p.phase === "pre") {
    snapshotBefore(p.repoRoot, p.snapshotKey);
    return parsed;
  }
  const seen = await changesSince(p.repoRoot, p.snapshotKey);
  if (!seen || seen.files.length === 0) return parsed;
  const extra = parsed.touches.filter((t) => !seen.files.includes(t.path));
  return {
    files: [...new Set([...seen.files, ...parsed.files])],
    touches: [...seen.touches, ...extra],
    references: [...new Set([...seen.references, ...parsed.references])],
  };
}

/** Classifier step 1. Never throws: anything unexpected degrades to file-level touches or nothing. */
export async function normalizeTool(p: NormalizeInput): Promise<Normalized> {
  let out: Normalized = { files: [], touches: [], references: [] };
  try {
    const filePath = str(p.input.file_path);
    if (EDIT_TOOLS.has(p.tool) && filePath) out = await normalizeEdit(p, filePath);
    else if (READ_TOOLS.has(p.tool)) out = normalizeRead(p);
    else if (p.tool === "Bash" && str(p.input.command)) out = await normalizeBash(p);
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
