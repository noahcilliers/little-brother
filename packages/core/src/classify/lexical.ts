const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "can",
  "will",
  "add",
  "use",
  "make",
  "call",
  "plan",
  "edit",
  "learn",
  "fail",
  "tried",
  "worked",
  "run",
  "test",
  "fix",
  "src",
  "web",
  "lib",
  "index",
]);

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of text.toLowerCase().split(/[^a-z0-9]+/)) if (t.length >= 3 && !STOP.has(t)) out.add(t);
  return out;
}

/**
 * Overlap coefficient of content words: the fallback retrieval signal when no embedder is configured.
 * Short prompts against long lessons score fairly because it divides by the smaller set.
 */
export function lexicalSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}
