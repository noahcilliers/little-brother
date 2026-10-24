/** Token cost read from a Claude Code transcript (JSONL entries, already parsed). */
export type TranscriptUsage = {
  /** tool_use id → tokens attributed to that call. */
  toolTokens: Record<string, number>;
  /** New tokens of the latest turn: every assistant message since the last user prompt. */
  turnTokens: number;
};

type Message = { cost: number; tools: string[] };

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * New tokens a message cost: what it wrote plus the input it added. Cache reads are context re-sent every turn,
 * not work done for this call, so they don't count.
 */
function costOf(usage: Record<string, unknown>): number {
  return num(usage.output_tokens) + num(usage.input_tokens) + num(usage.cache_creation_input_tokens);
}

/** A real prompt, not the tool_result entries Claude Code also logs as `user`. */
function isPrompt(e: Record<string, unknown>): boolean {
  if (e.type !== "user" || e.isMeta === true) return false;
  const content = rec(e.message).content;
  if (typeof content === "string") return content.trim().length > 0;
  return Array.isArray(content) && content.some((b) => rec(b).type === "text");
}

/**
 * Per-tool-call tokens: each assistant message's cost, split evenly over the tool calls it issued. Claude Code
 * writes one entry per content block and repeats the message's usage on each, so usage counts once per message
 * id while tool calls are collected across all of its entries. Never throws; unknown entries are skipped.
 */
export function transcriptUsage(entries: unknown[], maxTools = 500): TranscriptUsage {
  const messages = new Map<string, Message>();
  let turnStart = 0;
  for (const [i, raw] of entries.entries()) {
    const e = rec(raw);
    if (isPrompt(e)) {
      turnStart = messages.size;
      continue;
    }
    if (e.type !== "assistant") continue;
    const msg = rec(e.message);
    const id = typeof msg.id === "string" ? msg.id : `entry:${i}`;
    let m = messages.get(id);
    if (!m) {
      m = { cost: costOf(rec(msg.usage)), tools: [] };
      messages.set(id, m);
    }
    const content = Array.isArray(msg.content) ? msg.content : [];
    for (const block of content) {
      const b = rec(block);
      if (b.type === "tool_use" && typeof b.id === "string" && !m.tools.includes(b.id)) m.tools.push(b.id);
    }
  }
  const all = [...messages.values()];
  const pairs: [string, number][] = [];
  for (const m of all) {
    for (const id of m.tools) pairs.push([id, Math.round(m.cost / m.tools.length)]);
  }
  return {
    toolTokens: Object.fromEntries(pairs.slice(-maxTools)),
    turnTokens: all.slice(turnStart).reduce((sum, m) => sum + m.cost, 0),
  };
}
