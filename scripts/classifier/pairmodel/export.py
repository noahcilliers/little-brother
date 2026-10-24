"""Fitted scikit-learn estimators → the JSON format core's predict() reads, plus a reference predict.

The reference predict mirrors packages/core/src/classify/pair-model.ts line for line (float32 split
comparisons, softmax, per-class calibration, renormalization) so the TS round-trip test can hold the two
to 1e-6.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np

from .data import RELATIONS


def logreg_json(scaler, clf) -> dict:
    coef = np.asarray(clf.coef_, dtype=np.float64)
    bias = np.asarray(clf.intercept_, dtype=np.float64)
    if coef.shape[0] == 1:  # binary: softmax([0, z]) == sigmoid(z)
        coef = np.vstack([np.zeros_like(coef[0]), coef[0]])
        bias = np.array([0.0, bias[0]])
    return {
        "kind": "logreg",
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "weights": coef.tolist(),
        "bias": bias.tolist(),
    }


def _tree_nodes(tree, scale: float) -> List[dict]:
    t = tree.tree_
    nodes = []
    for i in range(t.node_count):
        if t.children_left[i] == -1:
            nodes.append({"v": float(t.value[i].ravel()[0]) * scale})
        else:
            nodes.append({"f": int(t.feature[i]), "t": float(t.threshold[i]), "l": int(t.children_left[i]), "r": int(t.children_right[i])})
    return nodes


def gbdt_json(clf, X_probe: np.ndarray) -> dict:
    """Trees with the learning rate folded into the leaves; the base score is recovered numerically."""
    stages = clf.estimators_
    binary = stages.shape[1] == 1
    trees = []
    for stage in stages:
        for k, est in enumerate(stage):
            trees.append({"c": 1 if binary else k, "nodes": _tree_nodes(est, clf.learning_rate)})
    k = 2 if binary else stages.shape[1]
    est = {"kind": "gbdt", "base": [0.0] * k, "trees": trees}
    raw = np.atleast_1d(clf.decision_function(X_probe[:1]))
    if binary:
        raw = np.array([0.0, raw[0]])
    contrib = _raw(est, X_probe[0])
    est["base"] = (raw.ravel() - contrib).tolist()
    return est


def _raw(est: dict, x: np.ndarray) -> np.ndarray:
    if est["kind"] == "logreg":
        z = (np.asarray(x) - np.asarray(est["mean"])) / np.asarray(est["scale"])
        return np.asarray(est["weights"]) @ z + np.asarray(est["bias"])
    out = np.array(est["base"], dtype=np.float64)
    x32 = np.asarray(x, dtype=np.float32)
    for tree in est["trees"]:
        i = 0
        while True:
            n = tree["nodes"][i]
            if "v" in n:
                out[tree["c"]] += n["v"]
                break
            # float(): NumPy 2 would otherwise round the float64 threshold down to float32 (NEP 50).
            i = n["l"] if float(x32[n["f"]]) <= n["t"] else n["r"]
    return out


def softmax(z: np.ndarray) -> np.ndarray:
    e = np.exp(z - z.max())
    return e / e.sum()


def calibrate(calibration, p: np.ndarray) -> np.ndarray:
    if not calibration:
        return p
    q = np.array([
        1.0 / (1.0 + np.exp(c["a"] * v + c["b"])) if c["kind"] == "platt" else float(np.interp(v, c["x"], c["y"]))
        for c, v in zip(calibration, p)
    ])
    s = q.sum()
    return q / s if s > 0 else p


def predict_json(model: dict, x: np.ndarray) -> Dict[str, float]:
    p = calibrate(model.get("calibration"), softmax(_raw(model["estimator"], x)))
    probs = {r: 0.0 for r in RELATIONS}
    for r, v in zip(model["classes"], p):
        probs[r] = float(v)
    return probs


def raw_probs(est: dict, X: np.ndarray) -> np.ndarray:
    return np.array([softmax(_raw(est, x)) for x in X])
