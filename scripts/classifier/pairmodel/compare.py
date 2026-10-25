"""Learning curves and baselines (rules only, an earlier model) on the same gold rows, out of fold."""
from __future__ import annotations

import json
from typing import Callable, Dict, List

import numpy as np

from .data import BLOCKING
from .export import predict_json, raw_probs
from .fit import _folds
from .report import per_relation

FRACTIONS = [0.1, 0.25, 0.5, 1.0]


def learning_curve(fit: Callable, ds, classes: List[str], k: int, gold: np.ndarray) -> Dict[str, Dict[str, float]]:
    """Per-relation out-of-fold F1 when each fold trains on a fraction of its training repositories."""
    rng = np.random.default_rng(0)
    out: Dict[str, Dict[str, float]] = {}
    folds = _folds(ds.y, ds.groups, k)
    for frac in FRACTIONS:
        pred = np.array([""] * len(ds.y), dtype=object)
        for train, test in folds:
            groups = np.unique(ds.groups[train])
            keep = set(rng.choice(groups, size=max(1, int(round(len(groups) * frac))), replace=False))
            sub = train[np.isin(ds.groups[train], list(keep))]
            if len(set(ds.y[sub])) < 2:
                continue
            m = fit(ds.X[sub], ds.y[sub], ds.w[sub], classes)
            p = raw_probs(m["est"], ds.X[test])
            pred[test] = np.array(m["classes"])[p.argmax(axis=1)]
        rel = per_relation(ds.y[gold], pred[gold].astype(str), classes)
        out[str(frac)] = {c: (r["f1"] or 0.0) for c, r in rel.items() if r["support"] > 0}
    return out


def rules_baseline(ds, gold: np.ndarray, classes: List[str]) -> Dict[str, dict]:
    """What the rules alone say: a settled rule verdict, else the fallback ("independent")."""
    pred = np.where(ds.rule == "", "independent", ds.rule)
    return per_relation(ds.y[gold], pred[gold], classes)


def _in_domain(model: dict, x: np.ndarray) -> bool:
    dom = model.get("domain")
    if not dom:
        return True
    col = {n: i for i, n in enumerate(model["featureNames"])}
    kind = lambda side: next((k for k in ("intent", "action", "knowledge") if x[col[f"{side}_{k}"]] == 1), "action")
    fm = x[col["failed_memory"]] == 1
    return f"{kind('next')}>{kind('other')}" in dom["kindPairs"] and (dom["failedMemory"] or not fm)


def previous_model(path: str, ds, gold: np.ndarray, classes: List[str]) -> dict:
    """An earlier model on today's rows. Feature lists are append-only, so its vector is a prefix of ours."""
    with open(path) as f:
        model = json.load(f)
    width = len(model["featureNames"])
    pred, settled = [], []
    for x in ds.X:
        probs = predict_json(model, x[:width])
        top = sorted(probs.values(), reverse=True)
        rel = max(probs, key=probs.get)
        t = (model.get("thresholds") or {}).get(rel, 0.9 if rel in BLOCKING else 0.75)
        pred.append(rel)
        settled.append(_in_domain(model, x[:width]) and top[0] >= t and top[0] - top[1] >= model.get("minMargin", 0.15))
    pred_a, settled_a = np.array(pred), np.array(settled)
    open_ = gold & (ds.rule == "")
    s = settled_a & open_
    return {
        "version": model["version"],
        "perRelation": per_relation(ds.y[gold], pred_a[gold], classes),
        "settledShare": float(s.sum() / open_.sum()) if open_.any() else None,
        "settledPrecision": float((pred_a[s] == ds.y[s]).mean()) if s.any() else None,
        "settledByRelation": {c: int((s & (pred_a == c)).sum()) for c in classes},
    }
