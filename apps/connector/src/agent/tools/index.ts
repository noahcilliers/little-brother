import type { ToolName } from "@lb/core";
import { editTool, readTool, writeTool } from "./files";
import { OutsideCwd } from "./paths";
import { globTool, grepTool } from "./search";
import { bashTool } from "./shell";
import type { ToolOutcome } from "./types";

export type { ToolOutcome } from "./types";

/** Runs one validated tool call. Never throws: a failure becomes an error result the model can read. */
export async function runTool(
  name: ToolName,
  input: Record<string, unknown>,
  cwd: string,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "Read":
        return readTool(cwd, input);
      case "Write":
        return writeTool(cwd, input);
      case "Edit":
        return editTool(cwd, input);
      case "Bash":
        return await bashTool(cwd, String(input.command ?? ""));
      case "Glob":
        return globTool(cwd, input);
      case "Grep":
        return grepTool(cwd, input);
    }
  } catch (e) {
    const text =
      e instanceof OutsideCwd ? e.message : `${name} failed: ${e instanceof Error ? e.message : String(e)}`;
    return { ok: false, text, response: { error: text } };
  }
}
