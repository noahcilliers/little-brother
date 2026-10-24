import { FEATURE_NAMES, FEATURE_VERSION } from "../src/classify/features";
import { type PairModel, parsePairModel } from "../src/classify/pair-model-schema";

export const zeros = (): number[] => new Array<number>(FEATURE_NAMES.length).fill(0);

/** A logistic model that only looks at its biases: a fixed answer for every pair. */
export function constantModel(
  bias: number[],
  classes: PairModel["classes"],
  extra: Partial<PairModel> = {},
): PairModel {
  const parsed = parsePairModel({
    format: "lb-pair-model",
    version: "test-1",
    featureVersion: FEATURE_VERSION,
    featureNames: [...FEATURE_NAMES],
    classes,
    estimator: {
      kind: "logreg",
      mean: zeros(),
      scale: zeros().map(() => 1),
      weights: classes.map(zeros),
      bias,
    },
    ...extra,
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.model;
}

/** Median wall time of one call after a warm-up: robust to other suites running in parallel. */
export function medianMs(fn: () => void, iterations = 400, warmup = 100): number {
  for (let i = 0; i < warmup; i++) fn();
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? 0;
}
