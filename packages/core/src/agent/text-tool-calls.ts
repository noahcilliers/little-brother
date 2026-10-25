import type { ToolCall } from "./chat";

// Small local models often answer with a tool call written as text (`<tool_call>{…}</tool_call>`, a fenced
// JSON block, or bare JSON) instead of the API's structured tool_calls. Recovering those turns is what makes
// a 7B model usable at all; only objects naming a known tool count, so prose with JSON in it stays prose.

const TAGGED = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const FENCED = /```(?:json)?\s*([\s\S]*?)```/g;

function candidates(text: string): string[] {
  const tagged = [...text.matchAll(TAGGED)].map((m) => m[1] ?? "");
  if (tagged.length) return tagged;
  const fenced = [...text.matchAll(FENCED)].map((m) => m[1] ?? "");
  if (fenced.length) return fenced;
  return [text.trim()];
}

function asCalls(value: unknown): { name: string; args: unknown }[] {
  const list = Array.isArray(value) ? value : [value];
  const out: { name: string; args: unknown }[] = [];
  for (const v of list) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const fn =
      typeof o.function === "object" && o.function !== null ? (o.function as Record<string, unknown>) : o;
    const name = fn.name ?? fn.tool;
    if (typeof name !== "string") continue;
    out.push({ name, args: fn.arguments ?? fn.parameters ?? fn.args ?? fn.input ?? {} });
  }
  return out;
}

/** Tool calls written as text, for known tool names only; ids are `<idPrefix>_<n>`. */
export function textToolCalls(text: string, known: Set<string>, idPrefix: string): ToolCall[] {
  if (!text.includes("{")) return [];
  const calls: ToolCall[] = [];
  for (const chunk of candidates(text)) {
    if (!chunk.startsWith("{") && !chunk.startsWith("[")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }
    for (const c of asCalls(parsed)) {
      if (known.has(c.name)) calls.push({ id: `${idPrefix}_${calls.length}`, name: c.name, args: c.args });
    }
  }
  return calls;
}
