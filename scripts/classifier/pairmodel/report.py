"""Metrics on out-of-fold predictions: per relation, confusion, calibration, and how often the judge is skipped."""
from __future__ import annotations

from typing import Dict, List

import numpy as np

from .data import BLOCKING

JUDGE_MS = 7000  # live eval median per judge call


def per_relation(y: np.ndarray, pred: np.ndarray, classes: List[str]) -> Dict[str, dict]:
    out = {}
    for c in classes:
        tp = int(((pred == c) & (y == c)).sum())
        fp = int(((pred == c) & (y != c)).sum())
        fn = int(((pred != c) & (y == c)).sum())
        p = tp / (tp + fp) if tp + fp else None
        r = tp / (tp + fn) if tp + fn else None
        f = 2 * p * r / (p + r) if p and r else (0.0 if p is not None and r is not None else None)
        out[c] = {"precision": p, "recall": r, "f1": f, "support": int((y == c).sum())}
    return out


def macro_f1(y, pred, classes) -> float:
    fs = [m["f1"] or 0.0 for m in per_relation(y, pred, classes).values() if m["support"] > 0]
    return float(np.mean(fs)) if fs else 0.0


def blocking_precision(y, pred) -> float:
    sel = np.isin(pred, list(BLOCKING))
    return float((np.isin(y[sel], list(BLOCKING))).mean()) if sel.any() else 0.0


def ece(Q: np.ndarray, y: np.ndarray, classes: List[str], bins: int = 10) -> float:
    conf = Q.max(axis=1)
    right = np.array([classes[j] for j in Q.argmax(axis=1)]) == y
    total = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        sel = (conf > lo) & (conf <= lo + 1.0 / bins)
        if sel.any():
            total += sel.mean() * abs(conf[sel].mean() - right[sel].mean())
    return float(total)


def confusion(y, pred, classes) -> Dict[str, Dict[str, int]]:
    return {t: {p: int(((y == t) & (pred == p)).sum()) for p in classes} for t in classes}


def settle_stats(settled: np.ndarray, open_: np.ndarray, right: np.ndarray, blocking_pred: np.ndarray) -> dict:
    """Over pairs no rule settles (what reaches step 4 live): how many the model keeps from the judge."""
    n = int(open_.sum())
    s = settled & open_
    return {
        "pairsReachingModel": n,
        "settledByModel": int(s.sum()),
        "settledShare": float(s.sum() / n) if n else None,
        "settledAccuracy": float(right[s].mean()) if s.any() else None,
        "settledBlocking": int((s & blocking_pred).sum()),
        "settledBlockingPrecision": float(right[s & blocking_pred].mean()) if (s & blocking_pred).any() else None,
        "judgeCallsSaved": int(s.sum()),
        "judgeSecondsSaved": round(float(s.sum()) * JUDGE_MS / 1000, 1),
    }


def markdown(m: dict) -> str:
    fmt = lambda v: "–" if v is None else f"{v:.2f}"
    head = "SYNTHETIC DATA — not real metrics. " if m["synthetic"] else ""
    lines = [
        f"## Pair model {m['version']} ({m['estimator']})",
        "",
        f"{head}{m['rows']} labelled pairs ({m['goldRows']} gold) from {m['groups']} repositories/runs; metrics are out-of-fold, "
        f"{m['folds']} folds grouped by repository, on gold labels. Calibration ECE {fmt(m['eceRaw'])} → {fmt(m['eceCalibrated'])}.",
        "",
        "| Relation | Precision | Recall | F1 | Support | Settle threshold |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for c, r in m["perRelation"].items():
        lines.append(f"| {c} | {fmt(r['precision'])} | {fmt(r['recall'])} | {fmt(r['f1'])} | {r['support']} | {m['thresholds'].get(c, 0):.2f} |")
    s = m["settle"]
    lines += [
        "",
        f"Macro-F1 {m['macroF1']:.3f}; blocking precision {m['blockingPrecision']:.3f}.",
        f"Of {s['pairsReachingModel']} gold pairs no rule settles, the model settles {s['settledByModel']} "
        f"({fmt(s['settledShare'])}) at accuracy {fmt(s['settledAccuracy'])}; that is {s['judgeCallsSaved']} judge calls "
        f"(~{s['judgeSecondsSaved']} s at 7 s each) saved.",
        "",
        "Per source (out-of-fold accuracy): " + ", ".join(f"{k} {v['accuracy']:.2f} (n={v['n']})" for k, v in m["perSource"].items()),
        "",
        "Settled without the judge, by source: "
        + ", ".join(f"{k} {v['settledByModel']}/{v['pairsReachingModel']} (accuracy {fmt(v['settledAccuracy'])})" for k, v in m["settleBySource"].items()),
        "",
        "Confusion (rows = truth, columns = predicted): see metrics.json.",
    ]
    return "\n".join(lines)
