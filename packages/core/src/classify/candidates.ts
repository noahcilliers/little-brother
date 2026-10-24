import { importerHits } from "./importers";
import {
  isMutation,
  MUTATING_OPS,
  mutationsReferencedBy,
  sharedMutatedPaths,
  sharedSymbols,
  symbolName,
} from "./touches";
import type { CandidatePair, ClassifiedNode } from "./types";

export type Candidate = {
  node: ClassifiedNode;
  /** Came from failure memory (failed action or knowledge), not from active work. */
  failedMemory: boolean;
  /** Cosine similarity from the vector index, when the embedder ran. */
  similarity?: number;
};

type Signal = { weight: number; reason: string; overlap: boolean };

export const TOP_K = 10;
const EXTRA_SIGNAL_BONUS = 0.05;

function activeSignals(next: ClassifiedNode, other: ClassifiedNode, similarity?: number): Signal[] {
  const out: Signal[] = [];
  const paths = sharedMutatedPaths(next, other);
  const firstPath = paths[0];
  if (firstPath) out.push({ weight: 1, reason: `both mutate ${firstPath[0].path}`, overlap: true });
  const sym = sharedSymbols(next, other).find(([a, b]) => isMutation(a) || isMutation(b));
  if (sym?.[0].symbol)
    out.push({ weight: 1, reason: `both touch ${symbolName(sym[0].symbol)}`, overlap: true });
  const refHit =
    mutationsReferencedBy(next, other, MUTATING_OPS)[0] ??
    mutationsReferencedBy(other, next, MUTATING_OPS)[0];
  if (refHit)
    out.push({ weight: 0.9, reason: `one mutates ${refHit.ref}, the other references it`, overlap: true });
  // The repo graph links an interface change to files importing it, even when the edit never names it.
  const imported = importerHits(next, other)[0] ?? importerHits(other, next)[0];
  if (imported)
    out.push({
      weight: imported.via === "symbol" ? 0.85 : 0.6,
      reason: `${imported.file} imports ${symbolName(imported.symbol)}`,
      overlap: imported.via === "symbol",
    });
  // A change to a topic and code that consumes it are the classic semantic-conflict pair (auth vs checkout).
  const consumed =
    (next.topic && other.consumes?.includes(next.topic) && next.topic) ||
    (other.topic && next.consumes?.includes(other.topic) && other.topic);
  if (consumed)
    out.push({ weight: 0.85, reason: `one changes ${consumed}, the other consumes it`, overlap: false });
  if (next.topic && next.topic === other.topic) {
    out.push({ weight: 0.9, reason: `same topic ${next.topic}`, overlap: false });
  }
  if (similarity !== undefined && (next.kind === "intent" || other.kind === "intent")) {
    out.push({
      weight: 0.8 * similarity,
      reason: `similar intent (${similarity.toFixed(2)})`,
      overlap: false,
    });
  }
  return out;
}

function failureSignals(next: ClassifiedNode, other: ClassifiedNode, similarity?: number): Signal[] {
  const out: Signal[] = [];
  if (next.signature && next.signature === other.signature) {
    out.push({ weight: 0.9, reason: "same signature as a recorded failure", overlap: true });
  }
  const otherPaths = new Set(other.touches.map((t) => t.path));
  const path = next.touches.find((t) => otherPaths.has(t.path) && !t.generated);
  if (path) out.push({ weight: 0.7, reason: `recorded failure touched ${path.path}`, overlap: false });
  if (next.topic && next.topic === other.topic) {
    out.push({ weight: 0.7, reason: `recorded failure on topic ${next.topic}`, overlap: false });
  }
  if (similarity !== undefined) {
    out.push({
      weight: 0.9 * similarity,
      reason: `similar to a recorded failure (${similarity.toFixed(2)})`,
      overlap: false,
    });
  }
  return out;
}

/**
 * Step 2: score and rank candidates. Max signal weight plus a small bonus per extra signal; keep the top k,
 * but never drop a path or symbol overlap. Same-agent work is excluded except for failure memory, so an
 * agent repeating its own failure after compaction is still caught.
 */
export function scoreCandidates(next: ClassifiedNode, candidates: Candidate[], k = TOP_K): CandidatePair[] {
  const seen = new Set<string>();
  const scored: (CandidatePair & { overlap: boolean })[] = [];
  for (const c of candidates) {
    const key = `${c.node.id}|${c.failedMemory}`;
    if (c.node.id === next.id || seen.has(key)) continue;
    seen.add(key);
    const sameAgent = c.node.agentId === next.agentId;
    if (sameAgent && !c.failedMemory) continue;
    const signals = c.failedMemory
      ? failureSignals(next, c.node, c.similarity)
      : activeSignals(next, c.node, c.similarity);
    if (signals.length === 0) continue;
    const max = Math.max(...signals.map((s) => s.weight));
    const score = Math.min(1, max + EXTRA_SIGNAL_BONUS * (signals.length - 1));
    if (score <= 0) continue;
    scored.push({
      next,
      other: c.node,
      retrievalScore: Number(score.toFixed(3)),
      reasons: signals.map((s) => s.reason),
      failedMemory: c.failedMemory,
      overlap: signals.some((s) => s.overlap),
    });
  }
  scored.sort((a, b) => b.retrievalScore - a.retrievalScore);
  return scored.filter((p, i) => i < k || p.overlap).map(({ overlap: _overlap, ...pair }) => pair);
}
