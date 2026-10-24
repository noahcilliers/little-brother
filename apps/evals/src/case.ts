import type { Relation } from "@lb/core";

export type Variant = "pointed" | "natural";
export const VARIANTS: readonly Variant[] = ["pointed", "natural"];

/** Verdict kinds the eval scores against; `normal` rows are not findings. */
export type FindingType = "duplicate" | "conflict" | "stale";

export type AgentEvent = "firstEdit" | "done";

/**
 * When an agent's prompt is sent. `after` waits for another agent's event, then `delaySec` more; without
 * `after`, `delaySec` counts from the start of the run. Live agents vary a lot in speed, so ordering beats
 * that matter ("A claims the file, then B collides") use `after`.
 */
export type Start = { delaySec?: number; after?: { agent: string; event: AgentEvent } };

export type AgentSpec = {
  /** LB member handle. Topic-map owners (noah, joshua, ash, maya, leo, priya) keep owner rules meaningful. */
  handle: string;
  prompt: Record<Variant, string>;
  start?: Start;
  /**
   * Send SessionEnd as soon as this agent finishes, like a session closed yesterday. Others are held open
   * until the case ends, as interactive sessions would be.
   */
  endsSession?: boolean;
};

/**
 * Post-run checks that say whether a planted clash actually happened. `on` is an agent's branch, or the
 * branch with every agent's work merged.
 */
export type Check =
  | { id: string; kind: "mergeConflict"; agents: [string, string] }
  | { id: string; kind: "grep"; pattern: string; paths?: string[]; on: string | "merged"; minFiles: number }
  | { id: string; kind: "commandFails"; run: string; on: string | "merged" }
  | { id: string; kind: "touched"; agent: string; file: string }
  | { id: string; kind: "ran"; agent: string; pattern: string }
  /** True when every listed check is true; for clashes that need both sides to have done their part. */
  | { id: string; kind: "allOf"; of: string[] };

export type Expectation = {
  agents: [string, string];
  type: FindingType;
  /** Reported, not scored: a hit with another relation still counts as a hit. */
  relation?: Relation;
  /** Check ids; the clash materialized when any of them is true. */
  evidence: string[];
};

/** A feature that must survive integration: a regex (JavaScript) found in at least `minFiles` files. */
export type Intact = { id: string; pattern: string; paths?: string[]; minFiles?: number };

/**
 * What a correct integrated result looks like, checked on the fix-up agent's tree. `run` commands must all
 * exit 0; the default leaves out the storefront-access unit test, which fails on the untouched shop.
 */
export type Success = { run?: string[]; intact?: Intact[] };

export const DEFAULT_SUCCESS_RUN = [
  "npm run typecheck",
  "npx vitest run test/unit --exclude test/unit/storefront-access.test.ts --passWithNoTests",
];

export type EvalCase = {
  id: string;
  title: string;
  /** Why this case exists: what it should prove about the classifier. */
  why: string;
  agents: AgentSpec[];
  /** Empty for controls: any finding is a false positive. */
  expect: Expectation[];
  checks: Check[];
  success?: Success;
};

export const isControl = (c: EvalCase): boolean => c.expect.length === 0;

/** Problems that would make a case unrunnable or unscoreable; empty when the case is sound. */
export function caseProblems(c: EvalCase): string[] {
  const out: string[] = [];
  const handles = new Set(c.agents.map((a) => a.handle));
  if (handles.size !== c.agents.length) out.push("duplicate agent handles");
  const checkIds = new Set(c.checks.map((k) => k.id));
  if (checkIds.size !== c.checks.length) out.push("duplicate check ids");
  const known = (h: string) => handles.has(h);
  for (const a of c.agents) {
    const dep = a.start?.after?.agent;
    if (dep && !known(dep)) out.push(`${a.handle} waits for unknown agent ${dep}`);
    if (dep === a.handle) out.push(`${a.handle} waits for itself`);
  }
  if (startOrder(c) === null) out.push("start triggers form a cycle");
  for (const e of c.expect) {
    for (const h of e.agents) if (!known(h)) out.push(`expectation names unknown agent ${h}`);
    if (e.evidence.length === 0) out.push(`expectation ${e.agents.join("+")} has no evidence checks`);
    for (const id of e.evidence) if (!checkIds.has(id)) out.push(`expectation cites unknown check ${id}`);
  }
  for (const k of c.checks) {
    if (k.kind === "allOf") {
      for (const id of k.of)
        if (!checkIds.has(id) || id === k.id) out.push(`check ${k.id} combines unknown check ${id}`);
      continue;
    }
    const named =
      k.kind === "mergeConflict" ? k.agents : "agent" in k ? [k.agent] : k.on === "merged" ? [] : [k.on];
    for (const h of named) if (!known(h)) out.push(`check ${k.id} names unknown agent ${h}`);
  }
  return out;
}

/** Agents in an order where everyone's trigger agent comes first, or null on a cycle. */
export function startOrder(c: EvalCase): string[] | null {
  const order: string[] = [];
  const pending = new Map(c.agents.map((a) => [a.handle, a.start?.after?.agent]));
  while (pending.size) {
    const ready = [...pending].filter(([, dep]) => !dep || !pending.has(dep));
    if (!ready.length) return null;
    for (const [h] of ready) {
      order.push(h);
      pending.delete(h);
    }
  }
  return order;
}
