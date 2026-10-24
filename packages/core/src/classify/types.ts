import type { Op } from "../ingest";

export const RELATIONS = [
  "independent",
  "overlap_compatible",
  "duplicate",
  "textual_conflict",
  "semantic_conflict",
  "intent_contradiction",
  "ordering_dependency",
  "repeats_failure",
] as const;
export type Relation = (typeof RELATIONS)[number];

export type EventType = "conflict" | "stale" | "duplicate" | "normal";
export const TYPE_OF: Record<Relation, EventType> = {
  independent: "normal",
  overlap_compatible: "normal",
  duplicate: "duplicate",
  textual_conflict: "conflict",
  semantic_conflict: "conflict",
  intent_contradiction: "conflict",
  ordering_dependency: "conflict",
  repeats_failure: "stale",
};

export type Action = "ignore" | "warn" | "serialize" | "block";
export const ACTION_RANK: Record<Action, number> = { ignore: 0, warn: 1, serialize: 2, block: 3 };
export type Direction = "new_needs_other" | "other_needs_new" | "none";
export type Source = "rule" | "pair_model" | "llm" | "fallback";

/**
 * How strongly an agent's claim on a node should hold when two agents collide. Compared in this order;
 * commit order only breaks exact ties (see decide.ts resolveCollision).
 */
export type Priority = {
  owner: boolean; // agent's member owns the node's topic in the topic map
  aligned: boolean; // agent authored the latest approved DECIDE on this topic
  scopeFit: boolean; // agent's current intent is on this node's topic
  progress: number; // succeeded actions + passing tests in the agent's current trajectory
};
export type Landed = "committed" | "pushed" | "merged";

/** A node as the classifier sees it (classifier step 1 output). */
export type ClassifiedNode = {
  id: string;
  agentId: string;
  kind: "intent" | "action" | "knowledge";
  verb: string;
  text: string; // compact signature
  topic?: string;
  outcome: "open" | "succeeded" | "failed" | "superseded";
  signature?: string;
  touches: { path: string; symbol?: string; op: Op; lines?: [number, number]; generated?: boolean }[];
  references: string[];
  at: number;
  baseRev?: string;
  landed?: Landed;
  preview?: string; // ≤40 lines of the change (diff hunk / content / command) — what the judge reads
  consumes?: string[]; // topics whose consumers globs cover this node's files
  priority?: Priority;
};

export type Hint = { rule: string; text: string };

/** Contract 5 — input to rules and the judge. */
export type CandidatePair = {
  next: ClassifiedNode;
  other: ClassifiedNode;
  retrievalScore: number;
  reasons: string[];
  failedMemory: boolean; // other came from failure memory, not active work
};

/** Contract 5 — one verdict per (new, candidate) pair. */
export type Judgment = {
  otherNodeId: string;
  relation: Relation;
  direction: Direction;
  confidence: number;
  evidence: string[];
  action: Action;
  source: Source;
  retrievalScore: number;
  latencyMs: number;
  /** Display type when it differs from TYPE_OF[relation], e.g. two creates of one file read as a duplicate. */
  type?: EventType;
  /** For collisions: whose claim holds. "next" means the new action takes over and the other side waits. */
  winner?: "next" | "other";
};

export type RuleResult =
  | { judgment: Omit<Judgment, "action" | "retrievalScore" | "latencyMs"> }
  | { hint: Hint }
  | null;
export interface Rule {
  id: string;
  check(pair: CandidatePair): RuleResult;
}
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}
export interface Judge {
  judge(
    pair: CandidatePair,
    hints: Hint[],
    examples: string[],
  ): Promise<Omit<Judgment, "action" | "retrievalScore" | "latencyMs"> | null>;
}

/** Rewrites a distilled trajectory into one readable line. Optional: deterministic text is the fallback. */
export interface Distiller {
  distill(prompt: string): Promise<string | null>;
}
