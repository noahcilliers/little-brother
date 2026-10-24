import { z } from "zod";
import { RELATIONS } from "./types";

/** Settings key the backend reads the current pair model from. */
export const PAIR_MODEL_KEY = "classifier:pair-model";
export const PAIR_MODEL_FORMAT = "lb-pair-model";

const Relation = z.enum(RELATIONS);
const num = z.number().finite();

/** Multinomial logistic regression over standardized features: z = W·((x − mean) / scale) + b. */
const LogReg = z.object({
  kind: z.literal("logreg"),
  mean: z.array(num),
  scale: z.array(num),
  weights: z.array(z.array(num)),
  bias: z.array(num),
});

/** A split goes left when the feature (as float32, like scikit-learn) is ≤ the threshold. */
const Split = z.object({
  f: z.number().int().min(0),
  t: num,
  l: z.number().int().min(1),
  r: z.number().int().min(1),
});
const Leaf = z.object({ v: num });

/** Gradient-boosted trees: raw score of class c = base[c] + Σ leaf values of the trees for c (learning rate folded in). */
const Gbdt = z.object({
  kind: z.literal("gbdt"),
  base: z.array(num),
  trees: z.array(z.object({ c: z.number().int().min(0), nodes: z.array(z.union([Split, Leaf])).min(1) })),
});

/** Per-class calibration of the softmax output, renormalized afterwards. */
const Calibration = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("platt"), a: num, b: num }),
  z.object({ kind: z.literal("isotonic"), x: z.array(num).min(1), y: z.array(num).min(1) }),
]);

export const PairModelSchema = z
  .object({
    format: z.literal(PAIR_MODEL_FORMAT),
    version: z.string().min(1),
    featureVersion: z.number().int(),
    featureNames: z.array(z.string()).min(1),
    classes: z.array(Relation).min(2),
    estimator: z.discriminatedUnion("kind", [LogReg, Gbdt]),
    calibration: z.array(Calibration).optional(),
    /** Minimum calibrated confidence to settle a pair, per relation; defaults in pair-model.ts. */
    thresholds: z.record(Relation, num).optional(),
    /** Escalate when the top two classes are this close (PLAN §4 step 4). */
    minMargin: num.default(0.15),
    /**
     * The (next kind > other kind) pairs and failure-memory setting the model was trained on. A pair outside
     * them goes to the judge: a model that never saw two plans must not call two plans compatible.
     */
    domain: z.object({ kindPairs: z.array(z.string()), failedMemory: z.boolean() }).optional(),
    /** Trained on generated data: never ship it as if it had real precision numbers. */
    synthetic: z.boolean().default(false),
    trainedAt: z.string().optional(),
    metrics: z.record(z.unknown()).optional(),
  })
  .superRefine((m, ctx) => {
    const k = m.classes.length;
    const f = m.featureNames.length;
    const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (new Set(m.classes).size !== k) bad("duplicate classes");
    if (m.calibration && m.calibration.length !== k) bad("calibration must have one entry per class");
    for (const c of m.calibration ?? [])
      if (c.kind === "isotonic" && c.x.length !== c.y.length) bad("isotonic x/y differ");
    const e = m.estimator;
    if (e.kind === "logreg") {
      if (e.mean.length !== f || e.scale.length !== f) bad("mean/scale length must match featureNames");
      if (e.bias.length !== k || e.weights.length !== k) bad("weights/bias must have one row per class");
      if (e.weights.some((w) => w.length !== f)) bad("weight rows must match featureNames");
      if (e.scale.some((s) => s === 0)) bad("scale must be non-zero");
      return;
    }
    if (e.base.length !== k) bad("base must have one entry per class");
    for (const t of e.trees) {
      if (t.c >= k) bad("tree class out of range");
      for (const n of t.nodes) {
        if ("f" in n && (n.f >= f || n.l >= t.nodes.length || n.r >= t.nodes.length))
          bad("tree index out of range");
      }
    }
  });
export type PairModel = z.infer<typeof PairModelSchema>;

export type LoadResult = { ok: true; model: PairModel } | { ok: false; error: string };

/**
 * Validate a stored model. With `expect`, also refuse one trained on other features, since reading the wrong
 * columns would give confident nonsense rather than an error.
 */
export function parsePairModel(
  raw: unknown,
  expect?: { featureVersion: number; featureNames: readonly string[] },
): LoadResult {
  const parsed = PairModelSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid model" };
  const m = parsed.data;
  if (expect) {
    if (m.featureVersion !== expect.featureVersion)
      return { ok: false, error: `feature version ${m.featureVersion}, expected ${expect.featureVersion}` };
    if (m.featureNames.join(",") !== expect.featureNames.join(","))
      return { ok: false, error: "feature names differ from this build" };
  }
  return { ok: true, model: m };
}
