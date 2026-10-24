import type { ClassifiedNode, Op, Relation } from "../../packages/core/src/index";
import { action, type Edit, intent, intentTruth, lesson, lines, pick, type Rand, sim } from "./synth-nodes";
import { type Planted, topicOf, type Unit } from "./synth-vocab";

// Pair shapes for the SYNTHETIC set: each planted clash or control becomes several node pairs at the intent
// and action level, some easy (a rule settles them) and some hard (only a model or the judge can tell).

export type Shape = {
  next: ClassifiedNode;
  other: ClassifiedNode;
  failedMemory: boolean;
  similarity?: number;
  truth: Relation;
  hard: boolean;
};

/** Action-level pairs for a planted clash: the shape the case's rule would see, plus a harder variant. */
function plantedActions(r: Rand, p: Planted, at: number): Shape[] {
  const path = pick(r, p.a.files) ?? "src/app.ts";
  const sym = pick(r, p.a.symbols) ?? "helper";
  const t0 = at;
  const t1 = at + 60_000 + Math.floor(r() * 600_000);
  const A = (e: Edit) => action("a", e, t0);
  const B = (e: Edit) => action("b", e, t1);
  const shape = (other: ClassifiedNode, next: ClassifiedNode, truth: Relation, hard: boolean): Shape => ({
    next,
    other,
    failedMemory: false,
    truth,
    hard,
  });
  const otherPath =
    pick(
      r,
      p.b.files.filter((f) => f !== path),
    ) ?? `src/${p.b.handle}/${sym}.ts`;
  switch (p.relation) {
    case "duplicate":
      return [
        shape(A({ path, op: "create" }), B({ path, op: "create" }), "textual_conflict", false),
        shape(
          A({ path, op: "create", symbol: sym }),
          B({ path: otherPath, op: "create", symbol: sym }),
          "duplicate",
          true,
        ),
      ];
    case "textual_conflict":
    case "intent_contradiction": {
      const same = p.b.files.includes(path);
      const easy = shape(
        A({ path, op: "write", lines: lines(r, 10) }),
        B({ path, op: "write", lines: lines(r, 12) }),
        "textual_conflict",
        false,
      );
      return same || p.relation === "textual_conflict"
        ? [
            easy,
            shape(
              A({ path, op: "write", symbol: sym }),
              B({ path, op: "write", symbol: sym }),
              "textual_conflict",
              true,
            ),
          ]
        : [
            easy,
            shape(
              A({ path, op: "write" }),
              B({ path: otherPath, op: "write" }),
              "intent_contradiction",
              true,
            ),
          ];
    }
    case "semantic_conflict": {
      const op: Op = r() < 0.5 ? "signature_change" : "rename";
      const consumer = otherPath;
      return [
        shape(
          A({ path, op, symbol: sym }),
          B({ path: consumer, op: "create", refs: [`${path}::${sym}`] }),
          "semantic_conflict",
          false,
        ),
        shape(
          A({ path, op, symbol: sym }),
          B({ path: consumer, op: "write", consumes: topicOf(path) ?? "contracts" }),
          "semantic_conflict",
          true,
        ),
      ];
    }
    case "ordering_dependency":
      return [
        shape(
          A({ path, op: "create", symbol: sym }),
          B({ path: otherPath, op: "create", refs: [`${path}::${sym}`] }),
          "ordering_dependency",
          false,
        ),
        shape(
          A({ path, op: "create", symbol: sym }),
          B({ path: otherPath, op: "write", consumes: topicOf(path) ?? "contracts" }),
          "ordering_dependency",
          true,
        ),
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
  const variant = action(
    "b",
    { path: p.a.files[0] ?? "src/server.ts", op: "write", lines: lines(r, 5) },
    at + 3_600_000,
  );
  const plan = intent(r, p.b, "b", at + 3_600_000);
  return [
    { next: retry, other: failedEdit, failedMemory: true, truth: "repeats_failure", hard: false },
    {
      next: variant,
      other: memory,
      failedMemory: true,
      similarity: sim(r, "repeats_failure"),
      truth: "repeats_failure",
      hard: true,
    },
    {
      next: plan,
      other: memory,
      failedMemory: true,
      similarity: sim(r, "repeats_failure"),
      truth: "repeats_failure",
      hard: !plan.topic,
    },
  ];
}

export function plantedShapes(r: Rand, p: Planted, at: number): Shape[] {
  if (p.relation === "repeats_failure") return staleShapes(r, p, at);
  const ia = intent(r, p.a, "a", at);
  const ib = intent(r, p.b, "b", at + 30_000);
  const truth = intentTruth(p.relation);
  return [
    { next: ib, other: ia, failedMemory: false, similarity: sim(r, truth), truth, hard: true },
    ...plantedActions(r, p, at),
  ];
}

/** Controls and unrelated scenario agents: related-looking work that must not be flagged. */
export function negativeShapes(r: Rand, a: Unit, b: Unit, at: number): Shape[] {
  const ia = intent(r, a, "a", at);
  const ib = intent(r, b, "b", at + 20_000);
  const linked =
    (ia.topic !== undefined && ia.topic === ib.topic) || a.files.some((f) => b.files.includes(f));
  const truth: Relation = linked ? "overlap_compatible" : "independent";
  const out: Shape[] = [
    { next: ib, other: ia, failedMemory: false, similarity: sim(r, truth), truth, hard: true },
  ];
  const path = pick(r, a.files);
  const sym = pick(r, a.symbols);
  if (path) {
    // Same file, disjoint hunks (R8 hint), and a consumer that only reads a symbol whose signature holds.
    out.push({
      next: action("b", { path, op: "write", lines: [60, 75] }, at + 90_000),
      other: action("a", { path, op: "write", lines: [5, 20] }, at),
      failedMemory: false,
      truth: "overlap_compatible",
      hard: false,
    });
    if (sym)
      out.push({
        next: action(
          "b",
          { path: pick(r, b.files) ?? "src/use.ts", op: "write", refs: [`${path}::${sym}`] },
          at + 90_000,
        ),
        other: action("a", { path, op: "write", symbol: sym }, at),
        failedMemory: false,
        truth: "overlap_compatible",
        hard: true,
      });
  }
  return out;
}
