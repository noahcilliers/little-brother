import { z } from "zod";
import type { ToolSchema } from "./chat";

// Named and shaped exactly like Claude Code's tools, so the connector's normalizer reads them unchanged and
// the classifier sees the same events whichever agent made them.

const s = (description: string) => ({ type: "string", description });

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "Read",
    description: "Read a file. Returns its lines numbered from 1. Use offset/limit for long files.",
    parameters: {
      type: "object",
      properties: {
        file_path: s("Path relative to the working directory"),
        offset: { type: "number", description: "First line to read (1-based)" },
        limit: { type: "number", description: "Number of lines to read" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "Write",
    description: "Create or overwrite a file with the given content.",
    parameters: {
      type: "object",
      properties: { file_path: s("Path relative to the working directory"), content: s("Full file content") },
      required: ["file_path", "content"],
    },
  },
  {
    name: "Edit",
    description:
      "Replace old_string with new_string in a file. old_string must match exactly and be unique unless replace_all is true. Read the file first.",
    parameters: {
      type: "object",
      properties: {
        file_path: s("Path relative to the working directory"),
        old_string: s("Exact text to replace"),
        new_string: s("Replacement text"),
        replace_all: { type: "boolean", description: "Replace every occurrence" },
      },
      required: ["file_path", "old_string", "new_string"],
    },
  },
  {
    name: "Bash",
    description: "Run a shell command in the working directory (bash, 120 s timeout). Output is truncated.",
    parameters: { type: "object", properties: { command: s("The command to run") }, required: ["command"] },
  },
  {
    name: "Glob",
    description: "List files matching a glob pattern such as src/**/*.ts (git-ignored files are skipped).",
    parameters: { type: "object", properties: { pattern: s("Glob pattern") }, required: ["pattern"] },
  },
  {
    name: "Grep",
    description: "Search file contents with a regular expression. Returns path:line: text matches.",
    parameters: {
      type: "object",
      properties: {
        pattern: s("JavaScript regular expression"),
        path: s("File or directory to search (default: working directory)"),
        glob: s("Only search files matching this glob"),
      },
      required: ["pattern"],
    },
  },
];

const opt = z.string().optional();
const PARSERS = {
  Read: z.object({
    file_path: z.string().min(1),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  Write: z.object({ file_path: z.string().min(1), content: z.string() }),
  Edit: z.object({
    file_path: z.string().min(1),
    old_string: z.string(),
    new_string: z.string(),
    replace_all: z.boolean().optional(),
  }),
  Bash: z.object({ command: z.string().min(1) }),
  Glob: z.object({ pattern: z.string().min(1) }),
  Grep: z.object({ pattern: z.string().min(1), path: opt, glob: opt }),
} as const;

export type ToolName = keyof typeof PARSERS;
export type ToolInput = Record<string, unknown>;
export const isToolName = (n: string): n is ToolName => Object.hasOwn(PARSERS, n);

/** Names other agents' tools use for the same fields; small models mix them up. */
const ALIASES: Record<string, string> = {
  path: "file_path",
  filePath: "file_path",
  filename: "file_path",
  file: "file_path",
  old_str: "old_string",
  new_str: "new_string",
  oldString: "old_string",
  newString: "new_string",
  contents: "content",
  text: "content",
  cmd: "command",
  replaceAll: "replace_all",
};

function canonical(name: ToolName, args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fields = Object.keys(PARSERS[name].shape);
  for (const [k, v] of Object.entries(args)) {
    const target = fields.includes(k) ? k : ALIASES[k];
    if (target && fields.includes(target) && !(target in out)) out[target] = v;
  }
  for (const k of ["offset", "limit"]) if (typeof out[k] === "string") out[k] = Number(out[k]);
  if (out.replace_all === "true") out.replace_all = true;
  return out;
}

export type ParsedArgs = { ok: true; input: ToolInput } | { ok: false; error: string };

/** Validates a model's tool arguments; the error text goes back to the model so it can retry. */
export function parseToolArgs(name: string, args: unknown): ParsedArgs {
  if (!isToolName(name))
    return { ok: false, error: `Unknown tool "${name}". Available: ${Object.keys(PARSERS).join(", ")}.` };
  let obj: unknown = args;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return { ok: false, error: `Arguments for ${name} are not valid JSON. Send a JSON object.` };
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj))
    return { ok: false, error: `Arguments for ${name} must be a JSON object.` };
  const parsed = PARSERS[name].safeParse(canonical(name, obj as Record<string, unknown>));
  if (parsed.success) return { ok: true, input: parsed.data };
  const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  return { ok: false, error: `Invalid arguments for ${name}: ${issues}.` };
}
