# Pair model (classifier step 4)

A small learned model that decides most rule-unsettled pairs in well under a millisecond, so the LLM
judge (~7 s a call) only sees the uncertain ones. PLAN §4 step 4.

```
rules (R1–R12) ──settled──▶ decide
      │ unsettled
      ▼
pair model ──confident (per-relation threshold, margin ≥ 0.15, pair kind seen in training)──▶ decide (source "pair_model")
      │ uncertain / out of domain / any error
      ▼
LLM judge (as before)
```

| Piece                                                         | Where                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Features (`pairFeatures`, `FEATURE_NAMES`, `FEATURE_VERSION`) | `packages/core/src/classify/features.ts`, `pair-signals.ts`                      |
| Model format (zod) and `predict`                              | `packages/core/src/classify/pair-model-schema.ts`, `pair-model.ts`               |
| Tier logic (settle or escalate), rule-derived direction       | `packages/core/src/classify/pair-tier.ts`, `pair-direction.ts`                   |
| Labelled-pair JSONL schema, gold/teacher labels               | `packages/core/src/classify/pair-dataset.ts`                                     |
| Offline replay (rules vs model vs cascade vs LLM)             | `packages/core/src/classify/replay.ts`, `scripts/classifier/replay.ts`           |
| Diff → touches (for public datasets)                          | `packages/core/src/classify/diff-touches.ts`                                     |
| Backend: load/upload/rollback, tier, export                   | `packages/backend/convex/classify/pairModel.ts`, `pairTier.ts`, `exportPairs.ts` |
| Trainer                                                       | `scripts/classifier/train.py` + `pairmodel/`                                     |

## Model format

`{ format: "lb-pair-model", version, featureVersion, featureNames, classes, estimator, calibration?, thresholds?, minMargin, domain?, synthetic, trainedAt, metrics }`
- `estimator` is either `logreg` (`mean`, `scale`, `weights[K][F]`, `bias[K]`; softmax over standardized
  features) or `gbdt` (`base[K]` plus `trees: [{ c, nodes: [{ f, t, l, r } | { v }] }]`, learning rate folded
  into leaves; a split goes left when float32(x) ≤ t, as in scikit-learn).
- `calibration`: one isotonic (`x`, `y`, linear interpolation, clipped) or Platt (`a`, `b`) map per class,
  then renormalized.
- `thresholds`: minimum calibrated confidence to settle, per relation. Defaults are 0.9 for blocking
  relations and 0.75 otherwise. The trainer sets them from out-of-fold predictions: 0.9 precision for
  findings, 0.95 for "nothing here" verdicts that also may not settle away more than 10% of any finding
  relation's gold positives, and 1.01 ("never settle") for a relation with fewer than 5 gold positives.
- `domain`: the `next>other` kind pairs and failure-memory setting seen in training. Anything else goes to
  the judge, so a model trained on PR diffs never rules on two plans.
- A model whose `featureVersion`/`featureNames` differ from the running build is refused at upload and at load.

## Data

Every source becomes the same JSONL (`LabelledPairSchema`): features recomputed with core's `pairFeatures`,
the rule verdict, the stored (teacher) verdict, the stored judge verdict, and a gold label when there is one.
Gold weighs 1, teacher (rule or LLM) 0.3. Datasets and trained models live outside the repo, under
`~/.cache/little-brother/` (override with `LB_DATASETS`).

```sh
# A deployment's classifications (teacher labels; gold from feedback / lb verify)
npx tsx scripts/classifier/export-deployment.ts --local --out ~/.cache/little-brother/datasets/pairs/local.jsonl
#   (or: cd packages/backend && npx convex run classify/exportPairs:page '{"paginationOpts":{"numItems":200,"cursor":null}}')

# Live eval runs (apps/evals): expected clash that materialized → gold positive; other pairs, controls → gold negative
pnpm --filter @lb/evals eval --export-pairs apps/evals/results/<run>     # writes <run>/pairs.jsonl

# AgenticFlict (agentic PRs × deterministic merge simulation): textual_conflict vs overlap_compatible
mkdir -p ~/.cache/little-brother/datasets/agenticflict && cd ~/.cache/little-brother/datasets/agenticflict
curl -sL https://zenodo.org/api/records/20118379/files/AgenticFlict.tar.gz/content | tar -xzf - \
  data/clean/agenticflict_pr_clean.csv data/clean/agenticflict_conflict_files_clean.csv
cd - && npx tsx scripts/classifier/datasets/agenticflict-fetch.ts --conflicts 600 --clean 1800   # gh api, cached
npx tsx scripts/classifier/datasets/agenticflict.ts

# STALE-bench (coupled PR pairs that merge cleanly; semantic interference measured)
git clone --depth 1 https://github.com/illinoisdata/STALE-bench ~/.cache/little-brother/datasets/stale-bench
npx tsx scripts/classifier/datasets/stale-bench.ts          # --labels uncorrected to use real_delta_blind.jsonl

# Our eval runs, all three levels: plans (prompts as each case/suite built them, plus every case's designed
# plans), final diffs (from /tmp/lb-evals worktrees, saved under datasets/eval-diffs before they are cleaned),
# and stored classification rows. Gold from the evidence checks / graded merge.
npx tsx scripts/classifier/datasets/eval-runs.ts --results apps/evals/results/pilot-1024,apps/evals/results/pilot-1024b

# CooperBench gold patches (benchmarks/CooperBench): 652 feature pairs, merge-checked → textual vs compatible
npx tsx scripts/classifier/datasets/cooperbench.ts

# GitHub mining (gh api, cached): "duplicate of #N" PRs, "depends on / blocked by #N" PRs, reverted relands,
# and a pool of merged PRs for negatives; then pairs at plan and code level
npx tsx scripts/classifier/datasets/github-mine.ts --per-repo 25
npx tsx scripts/classifier/datasets/github-mine.ts --relands-only llvm/llvm-project,pytorch/pytorch --per-repo 80
npx tsx scripts/classifier/datasets/github-pairs.ts

# TEACHER (weight 0.3): opposite-intent PR titles + matched controls, labelled by our Gemini judge adapter
npx tsx scripts/classifier/datasets/contradiction-teacher.ts --per-repo 12

# CI only: SYNTHETIC pairs from the eval cases and fixtures/scenario.jsonl (simulated judge)
npx tsx scripts/classifier/synth.ts --replicates 4 --out scripts/classifier/fixtures/synthetic.jsonl
```

Plan pairs are retrieved by intent similarity, as in production: Gemini cosine when the embedding cache
(`datasets/embeddings/`) has both texts, else the lexical score the backend falls back to without an embedder.

Label notes:
- **AgenticFlict** labels a PR against the base branch at the simulation anchor, so a pair is "the PR's
  changes" vs "the base branch's changes since the PR forked" (both from the GitHub compare API). Clean PRs
  are kept only when they share files with that drift. Shared files also become file-level pairs: a file in
  the dataset's conflict-file list is `textual_conflict`, any other shared file `overlap_compatible`.
- **STALE-bench**: `results/real_delta_blind.jsonl` is, per the benchmark's own README, the _uncorrected_
  harness and is inflated by a grading artifact (31 coupled pairs with Δ>0; the corrected harness finds 1).
  The default `--labels corrected` uses `results/real_corrected.jsonl`. The 36 "real-derived" instances
  (a real Django helper renamed / re-signatured / re-typed while another task reuses it; measured
  interference 2/3–3/3) are built from their metadata as `semantic_conflict` pairs. Disjoint-file controls
  are never retrieved by step 2, so they produce no pairs.

## Train, replay, upload, enable

```sh
uv run scripts/classifier/train.py --data <a.jsonl,b.jsonl,…> --out ~/.cache/little-brother/models/<version> --version <version>
# without uv: python3 -m venv .venv && .venv/bin/pip install numpy scikit-learn && .venv/bin/python scripts/classifier/train.py …

npx tsx scripts/classifier/replay.ts --data <a.jsonl,…> --model <out>/model.json --oof <out>/oof.jsonl --out <out>/replay

npx tsx scripts/classifier/upload.ts <out>/model.json --local      # validating mutation; keeps the previous model
cd packages/backend && npx convex env set CLASSIFIER_PAIR_MODEL 1  # off by default; rollback: npx convex run classify/pairModel:rollback
```

The trainer compares logistic regression and a GBDT on out-of-fold predictions grouped by repository (or
eval run / session), so no repository is ever on both sides of a split; best macro-F1 wins, blocking precision
breaks ties. Isotonic calibration and settle thresholds (≥ 0.9 precision on blocking relations, ≥ 0.95 on
"nothing here") are fit on those out-of-fold predictions, and the shipped model is then fit on all rows. It
refuses to write a model whose JSON disagrees with scikit-learn by more than 1e-6. Outputs: `model.json`,
`metrics.json` (per-relation P/R/F1, confusion, ECE before/after calibration, share settled without the judge,
per source), `report.md`, `oof.jsonl`. `--roundtrip <file>` also writes the fixture behind
`packages/core/test/classify-pair-model-roundtrip.test.ts`.

After changing features, bump `FEATURE_VERSION`, run `npx tsx scripts/classifier/feature-names.ts`, re-export
the data and retrain; old models are then refused instead of misread.

`--prev-model <model.json> --results <path>` adds the citable report: per-relation metrics on gold against
rules only and the earlier model (feature lists are append-only, so an older model reads a prefix of today's
vector), settle rates per relation, plan- vs code-level F1 and a learning curve (10/25/50/100% of training
repositories per fold).

Results: `results/2026-10-24-v2.{md,json}` (current), `results/2026-10-24-real.md` (first real-data model) and
`results/synthetic-fixture.md` (CI fixture: **not real metrics**).
