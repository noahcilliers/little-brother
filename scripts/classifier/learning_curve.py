# /// script
# requires-python = ">=3.9"
# dependencies = ["numpy>=1.24", "scikit-learn>=1.3"]
# ///
"""Learning curve for the pair model: the same grouped-by-repository CV as train.py, training on a fraction of each
fold's training rows (stratified by label, fixed seeds) and always scoring on the full held-out fold, so every point
is measured on the same pairs.

    python scripts/classifier/learning_curve.py --data a.jsonl,b.jsonl --out scripts/classifier/results/<date>-learning-curve
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pairmodel.data import BLOCKING, RELATIONS, load  # noqa: E402
from pairmodel.export import raw_probs  # noqa: E402
from pairmodel.fit import CANDIDATES, _folds, apply_calibration, choose_thresholds, fit_calibration, settled_mask  # noqa: E402
from pairmodel.report import blocking_precision, ece, macro_f1  # noqa: E402

FRACTIONS = [0.1, 0.25, 0.5, 0.75, 1.0]
SEEDS = [0, 1, 2]


def subsample(idx: np.ndarray, y: np.ndarray, frac: float, rng: np.random.Generator) -> np.ndarray:
    """A stratified share of idx: the same fraction of every label, at least one row of each label present."""
    if frac >= 1:
        return idx
    keep = []
    for label in sorted(set(y[idx])):
        rows = idx[y[idx] == label]
        n = max(1, int(round(len(rows) * frac)))
        keep.append(rng.choice(rows, size=n, replace=False))
    return np.sort(np.concatenate(keep))


def oof_at(fit, ds, classes, folds, frac: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    out = np.zeros((len(ds.y), len(classes)))
    for train, test in folds:
        part = subsample(train, ds.y, frac, rng)
        if len(set(ds.y[part])) < 2:
            out[test] = 1.0 / len(classes)
            continue
        m = fit(ds.X[part], ds.y[part], ds.w[part], classes)
        p = raw_probs(m["est"], ds.X[test])
        for j, c in enumerate(m["classes"]):
            out[test, classes.index(c)] = p[:, j]
    return out


def point(ds, classes, P: np.ndarray) -> dict:
    gold = ds.gold
    cal = fit_calibration(P, ds.y, classes)
    Q = apply_calibration(P, cal)
    pred = np.array([classes[j] for j in Q.argmax(axis=1)])
    settled = settled_mask(Q, classes, choose_thresholds(Q, ds.y, gold, classes))
    open_ = gold & (ds.rule == "")
    s = settled & open_
    return {
        "macroF1": macro_f1(ds.y[gold], pred[gold], classes),
        "blockingPrecision": blocking_precision(ds.y[gold], pred[gold]),
        "settledShare": float(s.sum() / open_.sum()) if open_.any() else 0.0,
        "settledAccuracy": float((pred == ds.y)[s].mean()) if s.any() else None,
        "ece": ece(Q[gold], ds.y[gold], classes),
    }


def mean_sd(values) -> dict:
    v = np.array([x for x in values if x is not None], dtype=float)
    return {"mean": round(float(v.mean()), 4), "sd": round(float(v.std()), 4)} if len(v) else {"mean": None, "sd": None}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True, help="path without extension; writes .json and .md")
    ap.add_argument("--estimator", choices=list(CANDIDATES), default="gbdt")
    ap.add_argument("--folds", type=int, default=5)
    a = ap.parse_args()

    ds = load(a.data.split(","))
    classes = sorted(r for r in RELATIONS if r in set(ds.y))
    folds = _folds(ds.y, ds.groups, a.folds)
    keys = ["macroF1", "blockingPrecision", "settledShare", "settledAccuracy", "ece"]
    points = []
    for frac in FRACTIONS:
        runs = [point(ds, classes, oof_at(CANDIDATES[a.estimator], ds, classes, folds, frac, seed)) for seed in SEEDS]
        train_rows = int(round(np.mean([len(t) for t, _ in folds]) * frac))
        p = {"fraction": frac, "trainRowsPerFold": train_rows, **{k: mean_sd(r[k] for r in runs) for k in keys}}
        points.append(p)
        print(f"{frac:>5.0%}  F1 {p['macroF1']['mean']:.3f}  blockP {p['blockingPrecision']['mean']:.3f}  "
              f"settled {p['settledShare']['mean']:.2f}  ECE {p['ece']['mean']:.3f}")
    result = {
        "estimator": a.estimator, "rows": len(ds.y), "goldRows": int(ds.gold.sum()), "groups": len(set(ds.groups)),
        "folds": len(folds), "seeds": SEEDS, "blocking": sorted(BLOCKING),
        "method": "grouped-by-repository CV as train.py; each fold's training rows subsampled per label; scored on the full held-out fold, gold labels only",
        "points": points,
    }
    with open(a.out + ".json", "w") as f:
        json.dump(result, f, indent=2)
    with open(a.out + ".md", "w") as f:
        f.write(markdown(result) + "\n")


def markdown(r: dict) -> str:
    fmt = lambda m, pct=False: "–" if m["mean"] is None else (f"{m['mean']:.0%} ± {m['sd']:.0%}" if pct else f"{m['mean']:.3f} ± {m['sd']:.3f}")
    lines = [
        f"# Pair model learning curve ({r['estimator']})",
        "",
        f"{r['goldRows']} gold of {r['rows']} labelled pairs from {r['groups']} repositories/runs. {r['method']}. "
        f"Mean ± sd over seeds {r['seeds']}.",
        "",
        "| Training share | Train rows / fold | Macro-F1 | Blocking precision | Open pairs settled without the judge | Settled accuracy | ECE |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for p in r["points"]:
        lines.append(f"| {p['fraction']:.0%} | {p['trainRowsPerFold']} | {fmt(p['macroF1'])} | {fmt(p['blockingPrecision'])} | "
                     f"{fmt(p['settledShare'], True)} | {fmt(p['settledAccuracy'], True)} | {fmt(p['ece'])} |")
    return "\n".join(lines)


if __name__ == "__main__":
    main()
