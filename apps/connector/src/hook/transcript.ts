import { readFileSync } from "node:fs";

type Usage = { input_tokens?: unknown; output_tokens?: unknown };
type Entry = { type?: unknown; message?: { id?: unknown; usage?: Usage } };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Sums input+output tokens of assistant entries. Claude Code writes one entry per content block
 * with the same message id and usage, so usage is counted once per message id.
 */
export function transcriptTokens(path: string | undefined): number | undefined {
  if (!path) return undefined;
  try {
    const seen = new Set<string>();
    let total = 0;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let e: Entry;
      try {
        e = JSON.parse(line) as Entry;
      } catch {
        continue;
      }
      const usage = e?.message?.usage;
      if (e?.type !== "assistant" || !usage) continue;
      const id = typeof e.message?.id === "string" ? e.message.id : undefined;
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      total += num(usage.input_tokens) + num(usage.output_tokens);
    }
    return total;
  } catch {
    return undefined;
  }
}
