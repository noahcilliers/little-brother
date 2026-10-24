import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { editTexts } from "../normalize/edits";
import { repoPath } from "../normalize/paths";

/**
 * `--apply`: writes a recorded Write/Edit to disk just before its PostToolUse line, as Claude Code
 * would, so later edits in the scenario normalize against the content they were recorded on.
 */
export function applyRecordedEdit(input: Record<string, unknown>, cwd: string): void {
  const tool = input.tool_name;
  const ti = input.tool_input;
  if (input.hook_event_name !== "PostToolUse" || typeof tool !== "string" || typeof ti !== "object" || !ti)
    return;
  if (tool !== "Write" && tool !== "Edit" && tool !== "MultiEdit") return;
  const toolInput = ti as Record<string, unknown>;
  if (typeof toolInput.file_path !== "string") return;
  const { abs } = repoPath(toolInput.file_path, cwd, cwd);
  const { after } = editTexts(tool, toolInput, abs, "pre", undefined);
  if (after === null) return;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, after);
}
