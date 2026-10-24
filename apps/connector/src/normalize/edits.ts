import { existsSync, readFileSync } from "node:fs";
import { applyEdits, capLines, revertEdits } from "./text";

export type Phase = "pre" | "post";
type EditSpec = { old_string: string; new_string: string; replace_all?: boolean };

/** Before/after text of an edit. `before` null = file did not exist; `after` null = unknown. */
export type EditTexts = { before: string | null; after: string | null; created: boolean; preview: string };

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function readOrNull(abs: string): string | null {
  try {
    return existsSync(abs) ? readFileSync(abs, "utf8") : null;
  } catch {
    return null;
  }
}

function editSpecs(tool: string, input: Record<string, unknown>): EditSpec[] {
  const raw = tool === "MultiEdit" && Array.isArray(input.edits) ? input.edits : [input];
  const out: EditSpec[] = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const r = e as Record<string, unknown>;
    const o = str(r.old_string);
    const n = str(r.new_string);
    if (o !== undefined && n !== undefined)
      out.push({ old_string: o, new_string: n, replace_all: r.replace_all === true });
  }
  return out;
}

function responseField(resp: unknown, key: string): unknown {
  return typeof resp === "object" && resp !== null ? (resp as Record<string, unknown>)[key] : undefined;
}

export function editTexts(
  tool: string,
  input: Record<string, unknown>,
  abs: string,
  phase: Phase,
  toolResponse: unknown,
): EditTexts {
  const original = str(responseField(toolResponse, "originalFile"));
  if (tool === "Write") {
    const content = str(input.content) ?? "";
    const preview = capLines(content);
    if (phase === "pre") {
      const before = readOrNull(abs);
      return { before, after: content, created: before === null, preview };
    }
    const created = responseField(toolResponse, "type") === "create";
    return { before: created ? null : (original ?? null), after: content, created, preview };
  }
  const specs = editSpecs(tool, input);
  const preview = capLines(
    specs
      .flatMap((e) => [
        ...e.old_string.split("\n").map((l) => `- ${l}`),
        ...e.new_string.split("\n").map((l) => `+ ${l}`),
      ])
      .join("\n"),
  );
  if (phase === "pre") {
    const before = readOrNull(abs);
    return { before, after: before === null ? null : applyEdits(before, specs), created: false, preview };
  }
  const after = readOrNull(abs);
  const before = original ?? (after === null ? null : revertEdits(after, specs));
  return { before, after: before === null ? null : after, created: false, preview };
}
