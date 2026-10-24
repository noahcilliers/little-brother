"""Candidate estimators, repository-grouped out-of-fold predictions, calibration and settle thresholds."""
from __future__ import annotations

from typing import Callable, Dict, List

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler

from .data import BLOCKING
from .export import gbdt_json, logreg_json, raw_probs

MIN_MARGIN = 0.15
MAX_CAL_POINTS = 200


def fit_logreg(X, y, w, classes) -> dict:
    scaler = StandardScaler().fit(X)
    clf = LogisticRegression(C=1.0, max_iter=4000, class_weight="balanced")
    clf.fit(scaler.transform(X), y, sample_weight=w)
    return {"est": logreg_json(scaler, clf), "classes": list(clf.classes_), "proba": lambda Z: clf.predict_proba(scaler.transform(Z))}


def fit_gbdt(X, y, w, classes) -> dict:
    clf = GradientBoostingClassifier(n_estimators=60, max_depth=3, learning_rate=0.1, subsample=0.9, random_state=0)
    clf.fit(X, y, sample_weight=w)
    return {"est": gbdt_json(clf, X), "classes": list(clf.classes_), "proba": clf.predict_proba}


CANDIDATES: Dict[str, Callable] = {"logreg": fit_logreg, "gbdt": fit_gbdt}


def _folds(y, groups, k: int):
    n_groups = len(set(groups))
    k = max(2, min(k, n_groups))
    try:
        return list(StratifiedGroupKFold(n_splits=k, shuffle=True, random_state=0).split(np.zeros(len(y)), y, groups))
    except ValueError:
        return list(GroupKFold(n_splits=k).split(np.zeros(len(y)), y, groups))


def check_export(m: dict, X: np.ndarray) -> float:
    """The exported JSON must reproduce scikit-learn's own probabilities; refuse to ship it otherwise."""
    gap = float(np.abs(raw_probs(m["est"], X) - m["proba"](X)).max())
    if gap > 1e-6:
        raise SystemExit(f"exported model disagrees with scikit-learn by {gap:.2e}")
    return gap


def oof_probs(fit: Callable, ds, classes: List[str], k: int) -> np.ndarray:
    """Every row predicted by a model that never saw its repository (or run)."""
    out = np.zeros((len(ds.y), len(classes)))
    for train, test in _folds(ds.y, ds.groups, k):
        if len(set(ds.y[train])) < 2:
            out[test] = 1.0 / len(classes)
            continue
        m = fit(ds.X[train], ds.y[train], ds.w[train], classes)
        p = raw_probs(m["est"], ds.X[test])
        for j, c in enumerate(m["classes"]):
            out[test, classes.index(c)] = p[:, j]
    return out


def fit_calibration(P: np.ndarray, y: np.ndarray, classes: List[str]) -> List[dict]:
    """Per-class isotonic maps on out-of-fold probabilities; identity where a class is too rare."""
    cal = []
    for j, c in enumerate(classes):
        hit = (y == c).astype(float)
        if hit.sum() < 5 or hit.sum() == len(hit):
            cal.append({"kind": "isotonic", "x": [0.0, 1.0], "y": [0.0, 1.0]})
            continue
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(P[:, j], hit)
        xs, ys = np.asarray(iso.X_thresholds_), np.asarray(iso.y_thresholds_)
        if len(xs) > MAX_CAL_POINTS:
            keep = np.unique(np.linspace(0, len(xs) - 1, MAX_CAL_POINTS).astype(int))
            xs, ys = xs[keep], ys[keep]
        cal.append({"kind": "isotonic", "x": xs.tolist(), "y": ys.tolist()})
    return cal


def apply_calibration(P: np.ndarray, cal: List[dict]) -> np.ndarray:
    Q = np.column_stack([np.interp(P[:, j], c["x"], c["y"]) for j, c in enumerate(cal)])
    s = Q.sum(axis=1, keepdims=True)
    return np.where(s > 0, Q / np.where(s > 0, s, 1), P)


def choose_thresholds(Q: np.ndarray, y: np.ndarray, gold: np.ndarray, classes: List[str]) -> Dict[str, float]:
    """Smallest confidence per relation whose settled pairs hit the precision target on gold labels.

    Blocking relations need 0.9 precision; "nothing here" verdicts need 0.95, because a real conflict settled
    as compatible never reaches the judge. Without at least 5 gold pairs to show it, a relation never settles
    (1.01): the model may not decide what it has not been shown to get right.
    """
    pred = Q.argmax(axis=1)
    top = np.sort(Q, axis=1)
    conf, margin = top[:, -1], top[:, -1] - top[:, -2]
    out: Dict[str, float] = {}
    for j, c in enumerate(classes):
        blocking = c in BLOCKING
        target = 0.9 if blocking else 0.95
        out[c] = 1.01
        for t in np.arange(0.5, 1.0, 0.01):
            sel = gold & (pred == j) & (conf >= t) & (margin >= MIN_MARGIN)
            if sel.sum() < 5:
                break
            if (y[sel] == c).mean() >= target:
                out[c] = round(float(t), 2)
                break
    return out


def settled_mask(Q: np.ndarray, classes: List[str], thresholds: Dict[str, float]) -> np.ndarray:
    pred = Q.argmax(axis=1)
    top = np.sort(Q, axis=1)
    t = np.array([thresholds[classes[j]] for j in pred])
    return (top[:, -1] >= t) & (top[:, -1] - top[:, -2] >= MIN_MARGIN)
