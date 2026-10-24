import type { ClassifiedNode, Op, Relation } from "../../packages/core/src/index";
import { type Planted, topicOf, type Unit } from "./synth-vocab";

// Pair shapes for the SYNTHETIC set: each planted clash or control becomes several node pairs at the intent
// and action level, some easy (a rule settles them) and some hard (only a model or the judge can tell).

export type Rand = () => number;
export type Shape = {
  next: ClassifiedNode;
  other: ClassifiedNode;
  failedMemory: boolean;
  similarity?: number;
  truth: Relation;
  hard: boolean;
};

let seq = 0;
const pick = <T>(r: Rand, xs: readonly T[]): T | undefined => xs[Math.floor(r() * xs.length)];
const between = (r: Rand, lo: number, hi: number) => Number((lo + r() * (hi - lo)).toFixed(3));
const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0] ?? s;

function base(agentId: string, kind: ClassifiedNode["kind"], verb: string, text: string, at: number): ClassifiedNode {
  seq += 1;
  return { id: `s${seq}`, agentId, kind, verb, text, outcome: "open", touches: [], references: [], at };
}

export function intent(r: Rand, u: Unit, agentId: string, at: number): ClassifiedNode {
  const prompt = pick(r, u.prompts) ?? u.handle;
  const n = base(agentId, "intent", "PLAN", `PLAN ${r() < 0.5 ? firstSentence(prompt) : prompt}`.slice(0, 220), at);
  const topic = u.files[0] ? topicOf(u.files[0]) : undefined;
  if (topic && r() < 0.6) n.topic = topic;
  if (r() < 0.4) n.touches = u.files.slice(0, 2).map((path) => ({ path, op: "write" as Op }));
  return n;
}

type Edit = { path: string; op: Op; symbol?: string; lines?: [number, number]; refs?: string[]; consumes?: string };

export function action(agentId: string, e: Edit, at: number, verb = "EDIT"): ClassifiedNode {
  const topic = topicOf(e.path);
  const n = base(agentId, "action", verb, `${verb} ${topic ? `${topic} ` : ""}${e.path}`, at);
  if (topic) n.topic = topic;
  n.touches = [
    { path: e.path, op: e.op, ...(e.symbol ? { symbol: `${e.path}::${e.symbol}` } : {}), ...(e.lines ? { lines: e.lines } : {}) },
  ];
  n.references = e.refs ?? [];
  if (e.consumes) n.consumes = [e.consumes];
  n.signature = `${verb}:${e.path}:${e.op}:${e.symbol ?? ""}:${seq}`;
  return n;
}

function lesson(u: Unit, agentId: string, at: number): ClassifiedNode {
  const path = u.files[0] ?? "src/server.ts";
  const topic = topicOf(path) ?? "api";
  const n = base(agentId, "knowledge", "LEARN", `LEARN ${topic}: tried EDIT ${topic} ${path} → FAIL: ${firstSentence(u.prompts[0] ?? "")}`.slice(0, 220), at);
  return { ...n, topic, outcome: "succeeded", touches: [{ path, op: "write" }], signature: `fail:${path}` };
}

const lines = (r: Rand, lo: number): [number, number] => {
  const a = lo + Math.floor(r() * 10);
  return [a, a + 5 + Math.floor(r() * 15)];
};

/** Intent-level truth for a planted clash: an R1-style line clash reads as contradictory plans. */
const intentTruth = (rel: Relation): Relation => (rel === "textual_conflict" ? "intent_contradiction" : rel);

const SIM: Partial<Record<Relation, [number, number]>> = {
  duplicate: [0.78, 0.96],
  intent_contradiction: [0.62, 0.88],
  repeats_failure: [0.6, 0.9],
  semantic_conflict: [0.45, 0.75],
  ordering_dependency: [0.45, 0.78],
  independent: [0.15, 0.62],
  overlap_compatible: [0.45, 0.85],
};
const sim = (r: Rand, rel: Relation) => between(r, ...(SIM[rel] ?? [0.3, 0.7]));

/** Action-level pairs for a planted clash: the shape the case's rule would see, plus a harder variant. */
function plantedActions(r: Rand, p: Planted, at: number): Shape[] {
  const path = pick(r, p.a.files) ?? "src/app.ts";
  const sym = pick(r, p.a.symbols) ?? "helper";
  const t0 = at;
  const t1 = at + 60_000 + Math.floor(r() * 600_000);
  const A = (e: Edit) => action("a", e, t0);
  const B = (e: Edit) => action("b", e, t1);
  const shape = (other: ClassifiedNode, next: ClassifiedNode, truth: Relation, hard: boolean): Shape => ({ next, other, failedMemory: false, truth, hard });
  const otherPath = pick(r, p.b.files.filter((f) => f !== path)) ?? `src/${p.b.handle}/${sym}.ts`;
  switch (p.relation) {
    case "duplicate":
      return [
        shape(A({ path, op: "create" }), B({ path, op: "create" }), "textual_conflict", false),
        shape(A({ path, op: "create", symbol: sym }), B({ path: otherPath, op: "create", symbol: sym }), "duplicate", true),
      ];
    case "textual_conflict":
    case "intent_contradiction": {
      const same = p.b.files.includes(path);
      const easy = shape(A({ path, op: "write", lines: lines(r, 10) }), B({ path, op: "write", lines: lines(r, 12) }), "textual_conflict", false);
      return same || p.relation === "textual_conflict"
        ? [easy, shape(A({ path, op: "write", symbol: sym }), B({ path, op: "write", symbol: sym }), "textual_conflict", true)]
        : [easy, shape(A({ path, op: "write" }), B({ path: otherPath, op: "write" }), "intent_contradiction", true)];
    }
    case "semantic_conflict": {
      const op: Op = r() < 0.5 ? "signature_change" : "rename";
      const consumer = otherPath;
      return [
        shape(A({ path, op, symbol: sym }), B({ path: consumer, op: "create", refs: [`${path}::${sym}`] }), "semantic_conflict", false),
        shape(A({ path, op, symbol: sym }), B({ path: consumer, op: "write", consumes: topicOf(path) ?? "contracts" }), "semantic_conflict", true),
      ];
    }
    case "ordering_dependency":
      return [
        shape(A({ path, op: "create", symbol: sym }), B({ path: otherPath, op: "create", refs: [`${path}::${sym}`] }), "ordering_dependency", false),
        shape(A({ path, op: "create", symbol: sym }), B({ path: otherPath, op: "write", consumes: topicOf(path) ?? "contracts" }), "ordering_dependency", true),
      ];
    default:
      return [];
  }
}

/** Stale cases: the earlier agent's failure as memory, the new agent's plan or edit as `next`. */
function staleShapes(r: Rand, p: Planted, at: number): Shape[] {
  const memory = lesson(p.a, "a", at);
  const failedEdit = action("a", { path: p.a.files[0] ?? "src/server.ts", op: "write" }, at);
  failedEdit.outcome = "failed";
  const retry = action("b", { path: p.a.files[0] ?? "src/server.ts", op: "write" }, at + 3_600_000);
  retry.signature = failedEdit.signature;
  const variant = action("b", { path: p.a.files[0] ?? "src/server.ts", op: "write", lines: lines(r, 5) }, at + 3_600_000);
  const plan = intent(r, p.b, "b", at + 3_600_000);
  return [
    { next: retry, other: failedEdit, failedMemory: true, truth: "repeats_failure", hard: false },
    { next: variant, other: memory, failedMemory: true, similarity: sim(r, "repeats_failure"), truth: "repeats_failure", hard: true },
    { next: plan, other: memory, failedMemory: true, similarity: sim(r, "repeats_failure"), truth: "repeats_failure", hard: !plan.topic },
  ];
}

export function plantedShapes(r: Rand, p: Planted, at: number): Shape[] {
  if (p.relation === "repeats_failure") return staleShapes(r, p, at);
  const ia = intent(r, p.a, "a", at);
  const ib = intent(r, p.b, "b", at + 30_000);
  const truth = intentTruth(p.relation);
  return [{ next: ib, other: ia, failedMemory: false, similarity: sim(r, truth), truth, hard: true }, ...plantedActions(r, p, at)];
}

/** Controls and unrelated scenario agents: related-looking work that must not be flagged. */
export function negativeShapes(r: Rand, a: Unit, b: Unit, at: number): Shape[] {
  const ia = intent(r, a, "a", at);
  const ib = intent(r, b, "b", at + 20_000);
  const linked = (ia.topic !== undefined && ia.topic === ib.topic) || a.files.some((f) => b.files.includes(f));
  const truth: Relation = linked ? "overlap_compatible" : "independent";
  const out: Shape[] = [{ next: ib, other: ia, failedMemory: false, similarity: sim(r, truth), truth, hard: true }];
  const path = pick(r, a.files);
  const sym = pick(r, a.symbols);
  if (path) {
    // Same file, disjoint hunks (R8 hint), and a consumer that only reads a symbol whose signature holds.
    out.push({ next: action("b", { path, op: "write", lines: [60, 75] }, at + 90_000), other: action("a", { path, op: "write", lines: [5, 20] }, at), failedMemory: false, truth: "overlap_compatible", hard: false });
    if (sym)
      out.push({
        next: action("b", { path: pick(r, b.files) ?? "src/use.ts", op: "write", refs: [`${path}::${sym}`] }, at + 90_000),
        other: action("a", { path, op: "write", symbol: sym }, at),
        failedMemory: false,
        truth: "overlap_compatible",
        hard: true,
      });
  }
  return out;
}
