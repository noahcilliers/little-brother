# /// script
# requires-python = ">=3.9"
# dependencies = ["numpy>=1.24", "scikit-learn>=1.3"]
# ///
"""Train Little Brother's pair model (PLAN §4 step 4) from labelled-pair JSONL.

    uv run scripts/classifier/train.py --data a.jsonl,b.jsonl --out out/
    # or: python3 -m venv .venv && .venv/bin/pip install numpy scikit-learn && .venv/bin/python scripts/classifier/train.py …

Gold labels weigh 1, teacher (rule/judge) labels 0.3. Logistic regression and a GBDT are compared on
out-of-fold predictions grouped by repository (or run), so no repository is ever in both train and test;
the better macro-F1 wins (blocking precision breaks ties). Isotonic calibration and per-relation settle
thresholds are fitted on those same out-of-fold predictions; the shipped model is then fit on everything.
Writes model.json (core's format), metrics.json, report.md and oof.jsonl (for replay.ts --oof).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pairmodel.data import BLOCKING, RELATIONS, feature_names, load  # noqa: E402
from pairmodel.export import predict_json, raw_probs  # noqa: E402
from pairmodel.fit import (  # noqa: E402
    CANDIDATES,
    MIN_MARGIN,
    apply_calibration,
    check_export,
    choose_thresholds,
    fit_calibration,
    oof_probs,
    settled_mask,
)
from pairmodel.report import blocking_precision, confusion, ece, macro_f1, markdown, per_relation, settle_stats  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
KINDS = ["intent", "action", "knowledge"]


def domain(X: np.ndarray, names) -> dict:
    """The kind pairs (and failure memory) seen in training; core's inDomain() sends anything else to the judge."""
    col = {n: i for i, n in enumerate(names)}
    kind = lambda x, side: next((k for k in KINDS if x[col[f"{side}_{k}"]] == 1), "action")
    pairs = sorted({f"{kind(x, 'next')}>{kind(x, 'other')}" for x in X})
    return {"kindPairs": pairs, "failedMemory": bool((X[:, col["failed_memory"]] == 1).any())}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="comma-separated JSONL files")
    ap.add_argument("--out", required=True)
    ap.add_argument("--features-json", default=os.path.join(HERE, "feature-names.json"))
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--estimator", choices=["auto", *CANDIDATES], default="auto")
    ap.add_argument("--version", default=None)
    ap.add_argument("--allow-mixed", action="store_true")
    ap.add_argument("--roundtrip", default=None, help="also write a TS round-trip fixture (both estimators) here")
    a = ap.parse_args()

    ds = load(a.data.split(","), allow_mixed=a.allow_mixed)
    names = feature_names(a.features_json, ds.feature_version, ds.X.shape[1])
    # scikit-learn orders classes by sort order; matching it keeps the exported rows aligned.
    classes = sorted(r for r in RELATIONS if r in set(ds.y))
    gold = ds.gold
    print(f"{len(ds.y)} rows ({int(gold.sum())} gold), {len(set(ds.groups))} groups, classes {classes}")
    if not gold.any():
        print("no gold labels: metrics below score against teacher labels")
        gold = np.ones_like(gold)

    results = {}
    for name in ([a.estimator] if a.estimator != "auto" else list(CANDIDATES)):
        P = oof_probs(CANDIDATES[name], ds, classes, a.folds)
        pred = np.array([classes[j] for j in P.argmax(axis=1)])
        results[name] = (P, macro_f1(ds.y[gold], pred[gold], classes), blocking_precision(ds.y[gold], pred[gold]))
        print(f"  {name}: out-of-fold macro-F1 {results[name][1]:.3f}, blocking precision {results[name][2]:.3f}")
    best = max(results, key=lambda n: (round(results[n][1], 3), results[n][2]))
    P = results[best][0]
    cal = fit_calibration(P, ds.y, classes)
    Q = apply_calibration(P, cal)
    thresholds = choose_thresholds(Q, ds.y, gold, classes)
    final = CANDIDATES[best](ds.X, ds.y, ds.w, classes)
    print(f"  export check: JSON vs scikit-learn max |Δp| = {check_export(final, ds.X):.1e}")
    if final["classes"] != classes:
        raise SystemExit("final model saw different classes than the folds")
    version = a.version or f"{dt.date.today().isoformat()}-{best}{'-synthetic' if ds.synthetic else ''}"
    pred = np.array([classes[j] for j in Q.argmax(axis=1)])
    settled = settled_mask(Q, classes, thresholds)
    open_ = gold & (ds.rule == "")
    metrics = {
        "version": version, "estimator": best, "synthetic": ds.synthetic, "rows": len(ds.y), "goldRows": int(ds.gold.sum()),
        "groups": len(set(ds.groups)), "folds": a.folds, "classes": classes,
        "candidates": {n: {"macroF1": r[1], "blockingPrecision": r[2]} for n, r in results.items()},
        "macroF1": macro_f1(ds.y[gold], pred[gold], classes), "blockingPrecision": blocking_precision(ds.y[gold], pred[gold]),
        "perRelation": per_relation(ds.y[gold], pred[gold], classes), "confusion": confusion(ds.y[gold], pred[gold], classes),
        "eceRaw": ece(P[gold], ds.y[gold], classes), "eceCalibrated": ece(Q[gold], ds.y[gold], classes),
        "thresholds": thresholds,
        "settle": settle_stats(settled, open_, pred == ds.y, np.isin(pred, list(BLOCKING))),
        "perSource": {s: {"n": int((gold & (ds.source == s)).sum()), "accuracy": float((pred == ds.y)[gold & (ds.source == s)].mean())}
                      for s in sorted(set(ds.source[gold]))},
        "settleBySource": {s: settle_stats(settled, open_ & (ds.source == s), pred == ds.y, np.isin(pred, list(BLOCKING)))
                           for s in sorted(set(ds.source[gold]))},
        "labelCounts": {c: int((ds.y == c).sum()) for c in classes},
    }
    model = {
        "format": "lb-pair-model", "version": version, "featureVersion": ds.feature_version, "featureNames": names,
        "classes": classes, "estimator": final["est"], "calibration": cal, "thresholds": thresholds, "minMargin": MIN_MARGIN,
        "domain": domain(ds.X, names), "synthetic": ds.synthetic, "trainedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "metrics": {k: metrics[k] for k in ("macroF1", "blockingPrecision", "eceCalibrated", "rows", "goldRows", "groups")},
    }
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "model.json"), "w") as f:
        json.dump(model, f)
    with open(os.path.join(a.out, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    with open(os.path.join(a.out, "report.md"), "w") as f:
        f.write(markdown(metrics) + "\n")
    with open(os.path.join(a.out, "oof.jsonl"), "w") as f:
        for i, row_id in enumerate(ds.ids):
            f.write(json.dumps({"id": row_id, "probs": dict(zip(classes, Q[i].round(6).tolist()))}) + "\n")
    print(markdown(metrics))
    if a.roundtrip:
        write_roundtrip(a.roundtrip, ds, names, classes, cal)


def write_roundtrip(path: str, ds, names, classes, cal) -> None:
    """Both estimator kinds, fit on the given data, with probabilities from the Python reference predict."""
    out = {"models": []}
    for name, fit in CANDIDATES.items():
        m = fit(ds.X, ds.y, ds.w, classes)
        check_export(m, ds.X)
        model = {"format": "lb-pair-model", "version": f"roundtrip-{name}", "featureVersion": ds.feature_version,
                 "featureNames": names, "classes": m["classes"], "estimator": m["est"], "minMargin": MIN_MARGIN, "synthetic": True}
        if m["classes"] == classes:
            model["calibration"] = cal
        X = ds.X[:: max(1, len(ds.X) // 25)][:25]
        uncal = raw_probs(m["est"], X)
        cases = [{"features": x.tolist(), "probs": predict_json(model, x), "uncalibrated": u.tolist()} for x, u in zip(X, uncal)]
        out["models"].append({"model": model, "cases": cases})
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        json.dump(out, f)
    print(f"round-trip fixture → {path}")


if __name__ == "__main__":
    main()
