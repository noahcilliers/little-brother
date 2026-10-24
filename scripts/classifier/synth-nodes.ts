import type { ClassifiedNode, Op, Relation } from "../../packages/core/src/index";
import { topicOf, type Unit } from "./synth-vocab";

// Node builders and sampling helpers for the SYNTHETIC pair shapes (synth-shapes.ts).

export type Rand = () => number;

let seq = 0;
export const pick = <T>(r: Rand, xs: readonly T[]): T | undefined => xs[Math.floor(r() * xs.length)];
export const between = (r: Rand, lo: number, hi: number) => Number((lo + r() * (hi - lo)).toFixed(3));
const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0] ?? s;

function base(
  agentId: string,
  kind: ClassifiedNode["kind"],
  verb: string,
  text: string,
  at: number,
): ClassifiedNode {
  seq += 1;
  return { id: `s${seq}`, agentId, kind, verb, text, outcome: "open", touches: [], references: [], at };
}

export function intent(r: Rand, u: Unit, agentId: string, at: number): ClassifiedNode {
  const prompt = pick(r, u.prompts) ?? u.handle;
  const n = base(
    agentId,
    "intent",
    "PLAN",
    `PLAN ${r() < 0.5 ? firstSentence(prompt) : prompt}`.slice(0, 220),
    at,
  );
  const topic = u.files[0] ? topicOf(u.files[0]) : undefined;
  if (topic && r() < 0.6) n.topic = topic;
  if (r() < 0.4) n.touches = u.files.slice(0, 2).map((path) => ({ path, op: "write" as Op }));
  return n;
}

export type Edit = {
  path: string;
  op: Op;
  symbol?: string;
  lines?: [number, number];
  refs?: string[];
  consumes?: string;
};

export function action(agentId: string, e: Edit, at: number, verb = "EDIT"): ClassifiedNode {
  const topic = topicOf(e.path);
  const n = base(agentId, "action", verb, `${verb} ${topic ? `${topic} ` : ""}${e.path}`, at);
  if (topic) n.topic = topic;
  n.touches = [
    {
      path: e.path,
      op: e.op,
      ...(e.symbol ? { symbol: `${e.path}::${e.symbol}` } : {}),
      ...(e.lines ? { lines: e.lines } : {}),
    },
  ];
  n.references = e.refs ?? [];
  if (e.consumes) n.consumes = [e.consumes];
  n.signature = `${verb}:${e.path}:${e.op}:${e.symbol ?? ""}:${seq}`;
  return n;
}

export function lesson(u: Unit, agentId: string, at: number): ClassifiedNode {
  const path = u.files[0] ?? "src/server.ts";
  const topic = topicOf(path) ?? "api";
  const n = base(
    agentId,
    "knowledge",
    "LEARN",
    `LEARN ${topic}: tried EDIT ${topic} ${path} → FAIL: ${firstSentence(u.prompts[0] ?? "")}`.slice(0, 220),
    at,
  );
  return { ...n, topic, outcome: "succeeded", touches: [{ path, op: "write" }], signature: `fail:${path}` };
}

export const lines = (r: Rand, lo: number): [number, number] => {
  const a = lo + Math.floor(r() * 10);
  return [a, a + 5 + Math.floor(r() * 15)];
};

/** Intent-level truth for a planted clash: an R1-style line clash reads as contradictory plans. */
export const intentTruth = (rel: Relation): Relation =>
  rel === "textual_conflict" ? "intent_contradiction" : rel;

const SIM: Partial<Record<Relation, [number, number]>> = {
  duplicate: [0.78, 0.96],
  intent_contradiction: [0.62, 0.88],
  repeats_failure: [0.6, 0.9],
  semantic_conflict: [0.45, 0.75],
  ordering_dependency: [0.45, 0.78],
  independent: [0.15, 0.62],
  overlap_compatible: [0.45, 0.85],
};
export const sim = (r: Rand, rel: Relation) => between(r, ...(SIM[rel] ?? [0.3, 0.7]));
