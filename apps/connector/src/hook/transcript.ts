import { readFileSync } from "node:fs";
import { type TranscriptUsage, transcriptUsage } from "@lb/core";

type Usage = { input_tokens?: unknown; output_tokens?: unknown };
type Entry = { type?: unknown; message?: { id?: unknown; usage?: Usage } };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Transcript JSONL entries; unreadable files and bad lines are skipped, never thrown. */
function readEntries(path: string | undefined): unknown[] | undefined {
  if (!path) return undefined;
  try {
    const out: unknown[] = [];
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // a partially written last line while the session is still appending
      }
    }
    return out;
  } catch {
    return undefined;
  }
}

/**
 * Sums input+output tokens of assistant entries. Claude Code writes one entry per content block
 * with the same message id and usage, so usage is counted once per message id.
 */
export function transcriptTokens(path: string | undefined): number | undefined {
  const entries = readEntries(path);
  if (!entries) return undefined;
  const seen = new Set<string>();
  let total = 0;
  for (const raw of entries) {
    const e = (raw ?? {}) as Entry;
    const usage = e.message?.usage;
    if (e.type !== "assistant" || !usage) continue;
    const id = typeof e.message?.id === "string" ? e.message.id : undefined;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    total += num(usage.input_tokens) + num(usage.output_tokens);
  }
  return total;
}

/** Per-tool-call tokens and the latest turn's total; undefined when the transcript can't be read. */
export function transcriptToolUsage(path: string | undefined): TranscriptUsage | undefined {
  const entries = readEntries(path);
  if (!entries) return undefined;
  try {
    return transcriptUsage(entries);
  } catch {
    return undefined;
  }
}
