// The trained pair model, measured out of fold (grouped by repository) on real labelled pairs:
// scripts/classifier/results/2026-10-24-real.md and 2026-10-24-learning-curve.md. The film's learning beats, the
// landing's results section and /report all read these.

export const CLASSIFIER = {
  pairs: 1709,
  gold: 1669,
  features: 73,
  /** Of gold pairs no rule settles, the share the model settles without the judge, and its accuracy there. */
  settledShare: 91,
  settledAccuracy: 98,
  blockingPrecision: { rules: 0.63, model: 0.79 },
  ece: { raw: 0.06, calibrated: 0.02 },
  latency: { rulesMs: 0.05, modelMs: 0.07, judgeS: 7 },
} as const;

/** Training share → out-of-fold metrics, mean of 3 seeds. Flat after half the data: shown as measured. */
export const LEARNING_CURVE: {
  share: number;
  trainRows: number;
  macroF1: number;
  blockingPrecision: number;
  settled: number;
  ece: number;
}[] = [
  { share: 10, trainRows: 137, macroF1: 0.47, blockingPrecision: 0.68, settled: 0.62, ece: 0.018 },
  { share: 25, trainRows: 342, macroF1: 0.509, blockingPrecision: 0.68, settled: 0.91, ece: 0.016 },
  { share: 50, trainRows: 684, macroF1: 0.563, blockingPrecision: 0.793, settled: 0.91, ece: 0.017 },
  { share: 75, trainRows: 1025, macroF1: 0.515, blockingPrecision: 0.783, settled: 0.92, ece: 0.019 },
  { share: 100, trainRows: 1367, macroF1: 0.518, blockingPrecision: 0.787, settled: 0.92, ece: 0.018 },
];
