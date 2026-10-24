import { Op } from "../ingest";
import type { ClassifiedNode } from "./types";

/** The stored node shape, structurally — keeps core free of Convex types. */
export type StoredNode = {
  _id: string;
  agentId: string;
  kind: ClassifiedNode["kind"];
  verb: string;
  text: string;
  topic?: string;
  files: string[];
  touches: { path: string; symbol?: string; op: string; lines?: number[]; generated?: boolean }[];
  references: string[];
  outcome: ClassifiedNode["outcome"];
  signature?: string;
  baseRev?: string;
  landed?: ClassifiedNode["landed"];
  preview?: string;
  consumes?: string[];
  importers?: ClassifiedNode["importers"];
  at: number;
};

/**
 * Step 1 output as the classifier sees it. Nodes without touches (plans, lessons) fall back to file-level
 * writes so path signals still fire; unknown ops degrade to `write` rather than being dropped.
 */
export function toClassifiedNode(n: StoredNode): ClassifiedNode {
  const touches: ClassifiedNode["touches"] = n.touches.map((t) => {
    const op = Op.safeParse(t.op);
    const [a, b] = t.lines ?? [];
    return {
      path: t.path,
      ...(t.symbol ? { symbol: t.symbol } : {}),
      op: op.success ? op.data : "write",
      ...(a !== undefined && b !== undefined ? { lines: [a, b] as [number, number] } : {}),
      ...(t.generated ? { generated: true } : {}),
    };
  });
  const covered = new Set(touches.map((t) => t.path));
  for (const f of n.files) if (!covered.has(f)) touches.push({ path: f, op: "write" });
  return {
    id: n._id,
    agentId: n.agentId,
    kind: n.kind,
    verb: n.verb,
    text: n.text,
    ...(n.topic ? { topic: n.topic } : {}),
    ...(n.preview ? { preview: n.preview } : {}),
    ...(n.consumes?.length ? { consumes: n.consumes } : {}),
    ...(n.importers?.length ? { importers: n.importers } : {}),
    outcome: n.outcome,
    ...(n.signature ? { signature: n.signature } : {}),
    touches,
    references: n.references,
    at: n.at,
    ...(n.baseRev ? { baseRev: n.baseRev } : {}),
    ...(n.landed ? { landed: n.landed } : {}),
  };
}

export const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/** "Active" means open, or finished less than 30 minutes ago. */
export function isActive(n: Pick<StoredNode, "outcome" | "at">, now: number): boolean {
  return n.outcome === "open" || now - n.at <= ACTIVE_WINDOW_MS;
}

/** Failed work, or a lesson about failed work (distilled lessons keep "→ FAIL" even when a fix later worked). */
export function isFailureMemory(n: Pick<StoredNode, "kind" | "outcome" | "text">): boolean {
  return n.outcome === "failed" || (n.kind === "knowledge" && /\bFAIL\b/.test(n.text));
}
